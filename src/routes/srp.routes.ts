import { Router } from 'express';
import {
  createSrp,
  listSrp,
  getActiveSrp,
  getSrpById,
} from '../controllers/srp.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import {
  CreateSrpSchema,
  ListSrpQuerySchema,
  GetSrpParamsSchema,
} from '../schemas/srp.schema';

const router = Router();

// POST /api/srp — Auth required
router.post('/', authenticate, validateRequest(CreateSrpSchema), createSrp);

// GET /api/srp — Public (paginated list with filters)
router.get('/', validateRequest(ListSrpQuerySchema), listSrp);

// GET /api/srp/active — Public (must be before /:id to avoid conflict)
router.get('/active', getActiveSrp);

// GET /api/srp/:id — Public
router.get('/:id', validateRequest(GetSrpParamsSchema), getSrpById);

export default router;
