# EXPLAIN ANALYZE — local-datos-reales

- Fecha: 2026-11-11T03:27:56.709Z
- Base: local (PostgreSQL en memoria, PGlite) · datos reales del catálogo (db/init.sql)
- Las consultas son las de los repositorios de la API (`server-api/src/repositories`), interceptadas con `EXPLAIN (ANALYZE, BUFFERS)`.

| Consulta | Usada por | Índices usados | Seq Scan en | Planificación (ms) | Ejecución (ms) |
|---|---|---|---|---:|---:|
| driver óptimo (hardware del catálogo) | POST /recommendations/driver · 1 por dispositivo al abrir la app | idx_hardware_lookup, uq_driver_recommendation, user_profiles_profile_name_key | — | 0.541 | 0.603 |
| ¿existe el hardware? (no catalogado → 404) | POST /recommendations/driver · caso más frecuente (7 de 9 en el PC de muestra) | idx_hardware_lookup | — | 0.317 | 0.127 |
| reglas de bloatware | GET /bloatware-rules | — | bloatware_rules | 0.092 | 0.271 |
| políticas de bloatware por perfil | GET /bloatware-rules?profiles=… | user_profiles_profile_name_key | bloatware_profile_policy | 0.189 | 0.581 |
| apps recomendadas por perfil | GET /recommendations/apps | user_profiles_profile_name_key, pk_profile_apps, recommended_apps_pkey | — | 0.451 | 0.402 |
| sesión vigente por token | TODA petición con cuenta (requireSession) | account_sessions_token_hash_key | — | 1.003 | 0.058 |
| cuenta por huella del correo | POST /auth/login | accounts_email_lookup_key | — | 0.407 | 0.030 |
| equipos de la cuenta | GET /account (estado) | ux_account_device | — | 0.424 | 0.047 |
| suscripción vigente | GET /account (estado) | idx_subscriptions_account | subscription_tiers | 0.788 | 0.058 |

## Planes completos

### driver óptimo (hardware del catálogo)

```sql
SELECT
  d.driver_id, d.edition_name, d.version_number,
  to_char(d.release_date, 'YYYY-MM-DD') AS release_date,
  d.download_url, d.file_size_mb, d.silent_install_flags,
  d.is_whql_certified, d.sha256, d.os_environment,
  p.profile_name,
  h.component_id, h.ven_id, h.dev_id, h.commercial_name, h.category
  FROM driver_packages d
  INNER JOIN hardware_components h ON h.component_id = d.component_id
  INNER JOIN user_profiles p       ON p.profile_id   = d.profile_id
  WHERE h.ven_id = $1
  AND h.dev_id = $2
  AND d.os_environment = $3
  AND p.profile_name = ANY($4::text[])
  ORDER BY d.is_whql_certified DESC, d.file_size_mb ASC;
```

```
Sort  (cost=25.88..25.88 rows=1 width=1405) (actual time=0.322..0.342 rows=2.00 loops=1)
  Sort Key: d.is_whql_certified DESC, d.file_size_mb
  Sort Method: quicksort  Memory: 17kB
  Buffers: shared hit=12
  ->  Nested Loop  (cost=4.45..25.87 rows=1 width=1405) (actual time=0.188..0.312 rows=2.00 loops=1)
        Join Filter: (d.profile_id = p.profile_id)
        Rows Removed by Join Filter: 5
        Buffers: shared hit=12
        ->  Nested Loop  (cost=0.29..16.34 rows=1 width=1263) (actual time=0.046..0.085 rows=4.00 loops=1)
              Buffers: shared hit=4
              ->  Index Scan using idx_hardware_lookup on hardware_components h  (cost=0.14..8.16 rows=1 width=516) (actual time=0.022..0.028 rows=1.00 loops=1)
                    Index Cond: (((ven_id)::text = '10DE'::text) AND ((dev_id)::text = '2520'::text))
                    Index Searches: 1
                    Buffers: shared hit=2
              ->  Index Scan using uq_driver_recommendation on driver_packages d  (cost=0.14..8.16 rows=1 width=751) (actual time=0.013..0.023 rows=4.00 loops=1)
                    Index Cond: ((component_id = h.component_id) AND ((os_environment)::text = 'Win11_x64'::text))
                    Index Searches: 1
                    Buffers: shared hit=2
        ->  Bitmap Heap Scan on user_profiles p  (cost=4.16..9.50 rows=2 width=122) (actual time=0.014..0.018 rows=1.75 loops=4)
              Recheck Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
              Heap Blocks: exact=4
              Buffers: shared hit=8
              ->  Bitmap Index Scan on user_profiles_profile_name_key  (cost=0.00..4.16 rows=2 width=0) (actual time=0.007..0.007 rows=2.00 loops=4)
                    Index Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                    Index Searches: 4
                    Buffers: shared hit=4
Planning Time: 0.385 ms
Execution Time: 0.399 ms
```

### ¿existe el hardware? (no catalogado → 404)

```sql
SELECT component_id
  FROM hardware_components
  WHERE ven_id = $1 AND dev_id = $2
  ORDER BY component_id ASC
  LIMIT 1
```

```
Limit  (cost=8.17..8.18 rows=1 width=4) (actual time=0.035..0.041 rows=0.00 loops=1)
  Buffers: shared hit=1
  ->  Sort  (cost=8.17..8.18 rows=1 width=4) (actual time=0.030..0.034 rows=0.00 loops=1)
        Sort Key: component_id
        Sort Method: quicksort  Memory: 17kB
        Buffers: shared hit=1
        ->  Index Scan using idx_hardware_lookup on hardware_components  (cost=0.14..8.16 rows=1 width=4) (actual time=0.021..0.022 rows=0.00 loops=1)
              Index Cond: (((ven_id)::text = '1532'::text) AND ((dev_id)::text = '0552'::text))
              Index Searches: 1
              Buffers: shared hit=1
Planning Time: 0.162 ms
Execution Time: 0.076 ms
```

### reglas de bloatware

```sql
SELECT bloatware_id, app_display_name, package_signature, package_names, detection_powershell_cmd, removal_powershell_cmd, risk_level, description, help_text, created_at
  FROM bloatware_rules
  ORDER BY bloatware_id ASC
```

```
Sort  (cost=13.82..14.05 rows=90 width=846) (actual time=0.197..0.254 rows=30.00 loops=1)
  Sort Key: bloatware_id
  Sort Method: quicksort  Memory: 33kB
  Buffers: shared hit=3
  ->  Seq Scan on bloatware_rules  (cost=0.00..10.90 rows=90 width=846) (actual time=0.018..0.101 rows=30.00 loops=1)
        Buffers: shared hit=3
Planning Time: 0.092 ms
Execution Time: 0.383 ms
```

### políticas de bloatware por perfil

```sql
SELECT bpp.bloatware_id, p.profile_name, bpp.policy
  FROM bloatware_profile_policy bpp
  INNER JOIN user_profiles p ON p.profile_id = bpp.profile_id
  WHERE p.profile_name = ANY($1::text[])
```

```
Hash Join  (cost=9.53..33.47 rows=10 width=160) (actual time=0.054..0.262 rows=60.00 loops=1)
  Hash Cond: (bpp.profile_id = p.profile_id)
  Buffers: shared hit=3
  ->  Seq Scan on bloatware_profile_policy bpp  (cost=0.00..21.00 rows=1100 width=46) (actual time=0.011..0.087 rows=120.00 loops=1)
        Buffers: shared hit=1
  ->  Hash  (cost=9.50..9.50 rows=2 width=122) (actual time=0.034..0.036 rows=2.00 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 5kB
        Buffers: shared hit=2
        ->  Bitmap Heap Scan on user_profiles p  (cost=4.16..9.50 rows=2 width=122) (actual time=0.025..0.028 rows=2.00 loops=1)
              Recheck Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
              Heap Blocks: exact=1
              Buffers: shared hit=2
              ->  Bitmap Index Scan on user_profiles_profile_name_key  (cost=0.00..4.16 rows=2 width=0) (actual time=0.015..0.016 rows=2.00 loops=1)
                    Index Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                    Index Searches: 1
                    Buffers: shared hit=1
Planning Time: 0.187 ms
Execution Time: 0.646 ms
```

### apps recomendadas por perfil

```sql
SELECT
  a.app_id, a.app_name, a.category, a.version_number,
  a.download_url, a.file_size_mb, a.silent_install_flags,
  a.winget_id, a.official_url,
  array_agg(DISTINCT p.profile_name ORDER BY p.profile_name) AS source_profiles
  FROM user_profiles p
  INNER JOIN profile_apps pa    ON pa.profile_id = p.profile_id
  INNER JOIN recommended_apps a ON a.app_id      = pa.app_id
  WHERE p.profile_name = ANY($1::text[])
  GROUP BY a.app_id, a.app_name, a.category, a.version_number,
  a.download_url, a.file_size_mb, a.silent_install_flags,
  a.winget_id, a.official_url
  ORDER BY a.category, a.app_name;
```

```
Sort  (cost=41.60..41.64 rows=18 width=994) (actual time=0.257..0.270 rows=10.00 loops=1)
  Sort Key: a.category, a.app_name
  Sort Method: quicksort  Memory: 19kB
  Buffers: shared hit=26
  ->  GroupAggregate  (cost=40.86..41.22 rows=18 width=994) (actual time=0.185..0.236 rows=10.00 loops=1)
        Group Key: a.app_name
        Buffers: shared hit=26
        ->  Sort  (cost=40.86..40.91 rows=18 width=1080) (actual time=0.170..0.184 rows=10.00 loops=1)
              Sort Key: a.app_name, p.profile_name
              Sort Method: quicksort  Memory: 18kB
              Buffers: shared hit=26
              ->  Nested Loop  (cost=8.53..40.49 rows=18 width=1080) (actual time=0.058..0.145 rows=10.00 loops=1)
                    Buffers: shared hit=26
                    ->  Nested Loop  (cost=8.38..37.14 rows=18 width=122) (actual time=0.048..0.087 rows=10.00 loops=1)
                          Buffers: shared hit=6
                          ->  Bitmap Heap Scan on user_profiles p  (cost=4.16..9.50 rows=2 width=122) (actual time=0.030..0.032 rows=2.00 loops=1)
                                Recheck Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                                Heap Blocks: exact=1
                                Buffers: shared hit=2
                                ->  Bitmap Index Scan on user_profiles_profile_name_key  (cost=0.00..4.16 rows=2 width=0) (actual time=0.017..0.018 rows=2.00 loops=1)
                                      Index Cond: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                                      Index Searches: 1
                                      Buffers: shared hit=1
                          ->  Bitmap Heap Scan on profile_apps pa  (cost=4.22..13.73 rows=9 width=8) (actual time=0.010..0.015 rows=5.00 loops=2)
                                Recheck Cond: (p.profile_id = profile_id)
                                Heap Blocks: exact=2
                                Buffers: shared hit=4
                                ->  Bitmap Index Scan on pk_profile_apps  (cost=0.00..4.22 rows=9 width=0) (actual time=0.003..0.004 rows=5.00 loops=2)
                                      Index Cond: (profile_id = p.profile_id)
                                      Index Searches: 2
                                      Buffers: shared hit=2
                    ->  Index Scan using recommended_apps_pkey on recommended_apps a  (cost=0.14..0.19 rows=1 width=962) (actual time=0.003..0.003 rows=1.00 loops=10)
                          Index Cond: (app_id = pa.app_id)
                          Index Searches: 10
                          Buffers: shared hit=20
Planning Time: 0.384 ms
Execution Time: 0.329 ms
```

### sesión vigente por token

```sql
SELECT session_id, account_id, device_hash
  FROM account_sessions
  WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
```

```
Index Scan using account_sessions_token_hash_key on account_sessions  (cost=0.15..8.17 rows=1 width=40) (actual time=0.008..0.009 rows=0.00 loops=1)
  Index Cond: (token_hash = '\xf8df118b5c18e4e98a332e50ffd6873f47e969169daf01880faa1ffd00b906b4'::bytea)
  Filter: ((revoked_at IS NULL) AND (expires_at > now()))
  Index Searches: 1
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=3
Planning Time: 0.119 ms
Execution Time: 0.032 ms
```

### cuenta por huella del correo

```sql
SELECT account_id, email_encrypted, password_hash, failed_logins, locked_until, created_at, privacy_version, privacy_accepted_at FROM accounts WHERE email_lookup = $1
```

```
Index Scan using accounts_email_lookup_key on accounts  (cost=0.15..8.17 rows=1 width=154) (actual time=0.009..0.010 rows=0.00 loops=1)
  Index Cond: (email_lookup = '\xcec36ed2d324300f0b72879413c77c3ac2c7dc138f58ca5868e23a3bf5b105ae'::bytea)
  Index Searches: 1
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=2
Planning Time: 0.109 ms
Execution Time: 0.036 ms
```

### equipos de la cuenta

```sql
SELECT device_id, device_hash, registered_at, last_seen_at
  FROM account_devices
  WHERE account_id = $1
  ORDER BY registered_at, device_id
```

```
Sort  (cost=12.72..12.73 rows=5 width=52) (actual time=0.025..0.027 rows=0.00 loops=1)
  Sort Key: registered_at, device_id
  Sort Method: quicksort  Memory: 17kB
  Buffers: shared hit=2
  ->  Bitmap Heap Scan on account_devices  (cost=4.19..12.66 rows=5 width=52) (actual time=0.016..0.017 rows=0.00 loops=1)
        Recheck Cond: (account_id = 1)
        Buffers: shared hit=2
        ->  Bitmap Index Scan on ux_account_device  (cost=0.00..4.19 rows=5 width=0) (actual time=0.006..0.006 rows=0.00 loops=1)
              Index Cond: (account_id = 1)
              Index Searches: 1
              Buffers: shared hit=2
Planning:
  Buffers: shared hit=2
Planning Time: 0.115 ms
Execution Time: 0.059 ms
```

### suscripción vigente

```sql
SELECT s.subscription_id, t.tier_name, t.duration_months, s.starts_at, s.ends_at,
  s.price_paid_clp, s.payment_reference
  FROM subscriptions s
  INNER JOIN subscription_tiers t ON t.tier_id = s.tier_id
  WHERE s.account_id = $1
  ORDER BY s.ends_at DESC
  LIMIT 1
```

```
Limit  (cost=0.15..13.50 rows=1 width=316) (actual time=0.013..0.015 rows=0.00 loops=1)
  Buffers: shared hit=2
  ->  Nested Loop  (cost=0.15..26.86 rows=2 width=316) (actual time=0.009..0.011 rows=0.00 loops=1)
        Join Filter: (t.tier_id = s.tier_id)
        Buffers: shared hit=2
        ->  Index Scan using idx_subscriptions_account on subscriptions s  (cost=0.15..12.18 rows=2 width=138) (actual time=0.008..0.009 rows=0.00 loops=1)
              Index Cond: (account_id = 1)
              Index Searches: 1
              Buffers: shared hit=2
        ->  Materialize  (cost=0.00..11.65 rows=110 width=186) (never executed)
              ->  Seq Scan on subscription_tiers t  (cost=0.00..11.10 rows=110 width=186) (never executed)
Planning:
  Buffers: shared hit=3
Planning Time: 0.214 ms
Execution Time: 0.044 ms
```
