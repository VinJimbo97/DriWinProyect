import { Router } from 'express';

// Importación de todos los módulos de rutas (Capa 3)
import healthRoutes from './health.routes.js';
import hardwareRoutes from './hardware.routes.js';
import driverRoutes from './driver.routes.js';
import recommendationsRoutes from './recommendations.routes.js';
import bloatwareRoutes from './bloatware.routes.js';

const router = Router();

// Montaje de las rutas en sus respectivos recursos REST
router.use('/health', healthRoutes);
router.use('/hardware-components', hardwareRoutes);
router.use('/driver-packages', driverRoutes);
router.use('/recommendations', recommendationsRoutes);
router.use('/bloatware-rules', bloatwareRoutes);

export default router;