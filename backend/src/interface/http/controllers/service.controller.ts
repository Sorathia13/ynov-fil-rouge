import { z } from 'zod';
import { ServiceCatalogService } from '../../../application/service-catalog.service';
import { asyncHandler } from '../async-handler';
import { idParam } from '../validators/common.validators';

const professionalIdParam = z.object({ professionalId: z.string().uuid() });
const listServicesQuery = z.object({ activeOnly: z.coerce.boolean().optional() });

export function serviceController(catalog: ServiceCatalogService) {
  return {
    create: asyncHandler(async (req, res) => {
      const { professionalId } = professionalIdParam.parse(req.params);
      res.status(201).json(await catalog.create(req.actor!, professionalId, req.body));
    }),

    listByProfessional: asyncHandler(async (req, res) => {
      const { professionalId } = professionalIdParam.parse(req.params);
      const { activeOnly } = listServicesQuery.parse(req.query);
      res.json(await catalog.listByProfessional(professionalId, { activeOnly }));
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      res.json(await catalog.update(req.actor!, id, req.body));
    }),

    deactivate: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      await catalog.deactivate(req.actor!, id);
      res.status(204).end();
    }),
  };
}
