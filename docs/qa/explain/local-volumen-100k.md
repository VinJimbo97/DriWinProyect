# EXPLAIN ANALYZE — local-volumen-100k

- Fecha: 2026-11-11T03:28:09.247Z
- Base: local (PostgreSQL en memoria, PGlite) · volumen simulado: 100000 componentes
- Las consultas son las de los repositorios de la API (`server-api/src/repositories`), interceptadas con `EXPLAIN (ANALYZE, BUFFERS)`.

| Consulta | Usada por | Índices usados | Seq Scan en | Planificación (ms) | Ejecución (ms) |
|---|---|---|---|---:|---:|
| driver óptimo (hardware del catálogo) | POST /recommendations/driver · 1 por dispositivo al abrir la app | idx_hardware_lookup, uq_driver_recommendation | user_profiles | 0.714 | 0.092 |
| ¿existe el hardware? (no catalogado → 404) | POST /recommendations/driver · caso más frecuente (7 de 9 en el PC de muestra) | idx_hardware_lookup | — | 0.117 | 0.047 |
| reglas de bloatware | GET /bloatware-rules | — | bloatware_rules | 0.182 | 0.067 |
| políticas de bloatware por perfil | GET /bloatware-rules?profiles=… | — | bloatware_profile_policy, user_profiles | 0.213 | 0.119 |
| apps recomendadas por perfil | GET /recommendations/apps | — | profile_apps, user_profiles, recommended_apps | 0.485 | 0.151 |
| sesión vigente por token | TODA petición con cuenta (requireSession) | account_sessions_token_hash_key | — | 0.236 | 0.061 |
| cuenta por huella del correo | POST /auth/login | accounts_email_lookup_key | — | 0.455 | 0.030 |
| equipos de la cuenta | GET /account (estado) | ux_account_device | — | 0.195 | 0.033 |
| suscripción vigente | GET /account (estado) | idx_subscriptions_account | subscription_tiers | 0.325 | 0.023 |

## Experimento: ¿sirve `idx_hardware_lookup`?

Se borra el índice dentro de una transacción (`BEGIN … ROLLBACK`, no cambia nada) y se repite el plan.

| Consulta | Con `idx_hardware_lookup` | Sin él |
|---|---|---|
| driver óptimo (hardware del catálogo) | idx_hardware_lookup, uq_driver_recommendation · 0.092 ms | uq_hardware_signature, uq_driver_recommendation · 0.081 ms |
| ¿existe el hardware? (no catalogado → 404) | idx_hardware_lookup · 0.047 ms | uq_hardware_signature · 0.056 ms |

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
Sort  (cost=26.42..26.43 rows=1 width=231) (actual time=0.071..0.076 rows=2.00 loops=1)
  Sort Key: d.is_whql_certified DESC, d.file_size_mb
  Sort Method: quicksort  Memory: 17kB
  Buffers: shared hit=13
  ->  Nested Loop  (cost=0.83..26.41 rows=1 width=231) (actual time=0.038..0.063 rows=2.00 loops=1)
        Buffers: shared hit=13
        ->  Index Scan using idx_hardware_lookup on hardware_components h  (cost=0.42..8.44 rows=1 width=45) (actual time=0.009..0.010 rows=1.00 loops=1)
              Index Cond: (((ven_id)::text = '10DE'::text) AND ((dev_id)::text = '2520'::text))
              Index Searches: 1
              Buffers: shared hit=4
        ->  Nested Loop  (cost=0.42..17.95 rows=2 width=162) (actual time=0.016..0.024 rows=2.00 loops=1)
              Buffers: shared hit=9
              ->  Seq Scan on user_profiles p  (cost=0.00..1.05 rows=2 width=11) (actual time=0.009..0.011 rows=2.00 loops=1)
                    Filter: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                    Rows Removed by Filter: 2
                    Buffers: shared hit=1
              ->  Index Scan using uq_driver_recommendation on driver_packages d  (cost=0.42..8.44 rows=1 width=159) (actual time=0.003..0.004 rows=1.00 loops=2)
                    Index Cond: ((component_id = h.component_id) AND (profile_id = p.profile_id) AND ((os_environment)::text = 'Win11_x64'::text))
                    Index Searches: 2
                    Buffers: shared hit=8
Planning:
  Buffers: shared hit=18
Planning Time: 0.347 ms
Execution Time: 0.105 ms
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
Limit  (cost=8.45..8.45 rows=1 width=4) (actual time=0.020..0.021 rows=0.00 loops=1)
  Buffers: shared hit=3
  ->  Sort  (cost=8.45..8.45 rows=1 width=4) (actual time=0.018..0.019 rows=0.00 loops=1)
        Sort Key: component_id
        Sort Method: quicksort  Memory: 17kB
        Buffers: shared hit=3
        ->  Index Scan using idx_hardware_lookup on hardware_components  (cost=0.42..8.44 rows=1 width=4) (actual time=0.014..0.014 rows=0.00 loops=1)
              Index Cond: (((ven_id)::text = '1532'::text) AND ((dev_id)::text = '0552'::text))
              Index Searches: 1
              Buffers: shared hit=3
Planning Time: 0.131 ms
Execution Time: 0.039 ms
```

### reglas de bloatware

```sql
SELECT bloatware_id, app_display_name, package_signature, package_names, detection_powershell_cmd, removal_powershell_cmd, risk_level, description, help_text, created_at
  FROM bloatware_rules
  ORDER BY bloatware_id ASC
```

```
Sort  (cost=4.04..4.11 rows=30 width=524) (actual time=0.039..0.046 rows=30.00 loops=1)
  Sort Key: bloatware_id
  Sort Method: quicksort  Memory: 33kB
  Buffers: shared hit=3
  ->  Seq Scan on bloatware_rules  (cost=0.00..3.30 rows=30 width=524) (actual time=0.008..0.021 rows=30.00 loops=1)
        Buffers: shared hit=3
Planning Time: 0.048 ms
Execution Time: 0.063 ms
```

### políticas de bloatware por perfil

```sql
SELECT bpp.bloatware_id, p.profile_name, bpp.policy
  FROM bloatware_profile_policy bpp
  INNER JOIN user_profiles p ON p.profile_id = bpp.profile_id
  WHERE p.profile_name = ANY($1::text[])
```

```
Hash Join  (cost=1.07..3.92 rows=60 width=20) (actual time=0.016..0.088 rows=60.00 loops=1)
  Hash Cond: (bpp.profile_id = p.profile_id)
  Buffers: shared hit=2
  ->  Seq Scan on bloatware_profile_policy bpp  (cost=0.00..2.20 rows=120 width=17) (actual time=0.004..0.029 rows=120.00 loops=1)
        Buffers: shared hit=1
  ->  Hash  (cost=1.05..1.05 rows=2 width=11) (actual time=0.008..0.009 rows=2.00 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 5kB
        Buffers: shared hit=1
        ->  Seq Scan on user_profiles p  (cost=0.00..1.05 rows=2 width=11) (actual time=0.004..0.006 rows=2.00 loops=1)
              Filter: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
              Rows Removed by Filter: 2
              Buffers: shared hit=1
Planning:
  Buffers: shared hit=4
Planning Time: 0.105 ms
Execution Time: 0.111 ms
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
Sort  (cost=4.39..4.42 rows=10 width=241) (actual time=0.108..0.114 rows=10.00 loops=1)
  Sort Key: a.category, a.app_name
  Sort Method: quicksort  Memory: 19kB
  Buffers: shared hit=3
  ->  GroupAggregate  (cost=4.03..4.23 rows=10 width=241) (actual time=0.082..0.100 rows=10.00 loops=1)
        Group Key: a.app_name
        Buffers: shared hit=3
        ->  Sort  (cost=4.03..4.05 rows=10 width=216) (actual time=0.073..0.080 rows=10.00 loops=1)
              Sort Key: a.app_name, p.profile_name
              Sort Method: quicksort  Memory: 18kB
              Buffers: shared hit=3
              ->  Hash Join  (cost=2.52..3.86 rows=10 width=216) (actual time=0.045..0.067 rows=10.00 loops=1)
                    Hash Cond: (pa.app_id = a.app_id)
                    Buffers: shared hit=3
                    ->  Hash Join  (cost=1.07..2.38 rows=10 width=11) (actual time=0.022..0.037 rows=10.00 loops=1)
                          Hash Cond: (pa.profile_id = p.profile_id)
                          Buffers: shared hit=2
                          ->  Seq Scan on profile_apps pa  (cost=0.00..1.20 rows=20 width=8) (actual time=0.007..0.013 rows=20.00 loops=1)
                                Buffers: shared hit=1
                          ->  Hash  (cost=1.05..1.05 rows=2 width=11) (actual time=0.011..0.012 rows=2.00 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 5kB
                                Buffers: shared hit=1
                                ->  Seq Scan on user_profiles p  (cost=0.00..1.05 rows=2 width=11) (actual time=0.006..0.007 rows=2.00 loops=1)
                                      Filter: ((profile_name)::text = ANY ('{Gamer,Developer}'::text[]))
                                      Rows Removed by Filter: 2
                                      Buffers: shared hit=1
                    ->  Hash  (cost=1.20..1.20 rows=20 width=209) (actual time=0.020..0.021 rows=20.00 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 8kB
                          Buffers: shared hit=1
                          ->  Seq Scan on recommended_apps a  (cost=0.00..1.20 rows=20 width=209) (actual time=0.003..0.009 rows=20.00 loops=1)
                                Buffers: shared hit=1
Planning:
  Buffers: shared hit=12
Planning Time: 0.276 ms
Execution Time: 0.151 ms
```

### sesión vigente por token

```sql
SELECT session_id, account_id, device_hash
  FROM account_sessions
  WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
```

```
Index Scan using account_sessions_token_hash_key on account_sessions  (cost=0.41..8.44 rows=1 width=41) (actual time=0.008..0.009 rows=0.00 loops=1)
  Index Cond: (token_hash = '\xf8df118b5c18e4e98a332e50ffd6873f47e969169daf01880faa1ffd00b906b4'::bytea)
  Filter: ((revoked_at IS NULL) AND (expires_at > now()))
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.057 ms
Execution Time: 0.019 ms
```

### cuenta por huella del correo

```sql
SELECT account_id, email_encrypted, password_hash, failed_logins, locked_until, created_at, privacy_version, privacy_accepted_at FROM accounts WHERE email_lookup = $1
```

```
Index Scan using accounts_email_lookup_key on accounts  (cost=0.29..8.30 rows=1 width=76) (actual time=0.020..0.022 rows=1.00 loops=1)
  Index Cond: (email_lookup = '\xcec36ed2d324300f0b72879413c77c3ac2c7dc138f58ca5868e23a3bf5b105ae'::bytea)
  Index Searches: 1
  Buffers: shared hit=3
Planning Time: 0.089 ms
Execution Time: 0.044 ms
```

### equipos de la cuenta

```sql
SELECT device_id, device_hash, registered_at, last_seen_at
  FROM account_devices
  WHERE account_id = $1
  ORDER BY registered_at, device_id
```

```
Sort  (cost=8.31..8.32 rows=1 width=53) (actual time=0.019..0.020 rows=1.00 loops=1)
  Sort Key: registered_at, device_id
  Sort Method: quicksort  Memory: 17kB
  Buffers: shared hit=3
  ->  Index Scan using ux_account_device on account_devices  (cost=0.29..8.30 rows=1 width=53) (actual time=0.012..0.013 rows=1.00 loops=1)
        Index Cond: (account_id = 1)
        Index Searches: 1
        Buffers: shared hit=3
Planning Time: 0.065 ms
Execution Time: 0.034 ms
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
Limit  (cost=0.28..9.37 rows=1 width=64) (actual time=0.007..0.009 rows=0.00 loops=1)
  Buffers: shared hit=2
  ->  Nested Loop  (cost=0.28..9.37 rows=1 width=64) (actual time=0.005..0.006 rows=0.00 loops=1)
        Join Filter: (t.tier_id = s.tier_id)
        Buffers: shared hit=2
        ->  Index Scan using idx_subscriptions_account on subscriptions s  (cost=0.28..8.30 rows=1 width=42) (actual time=0.004..0.005 rows=0.00 loops=1)
              Index Cond: (account_id = 1)
              Index Searches: 1
              Buffers: shared hit=2
        ->  Seq Scan on subscription_tiers t  (cost=0.00..1.03 rows=3 width=30) (never executed)
Planning:
  Buffers: shared hit=4
Planning Time: 0.116 ms
Execution Time: 0.021 ms
```
