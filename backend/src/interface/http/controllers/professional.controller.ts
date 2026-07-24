import { z } from 'zod';
import { ProfessionalService } from '../../../application/professional.service';
import { asyncHandler } from '../async-handler';
import { idParam, paginationQuery } from '../validators/common.validators';

const listQuery = paginationQuery.extend({ search: z.string().max(100).optional() });
const timeOffParams = z.object({ id: z.string().uuid(), timeOffId: z.string().uuid() });

export function professionalController(pros: ProfessionalService) {
  return {
    create: asyncHandler(async (req, res) => {
      res.status(201).json(await pros.createForUser(req.actor!, req.body));
    }),

    me: asyncHandler(async (req, res) => {
      res.json(await pros.getMine(req.actor!));
    }),

    getById: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      res.json(await pros.getById(id));
    }),

    list: asyncHandler(async (req, res) => {
      res.json(await pros.list(listQuery.parse(req.query)));
    }),

    update: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      res.json(await pros.update(req.actor!, id, req.body));
    }),

    setWorkingHours: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { hours } = req.body as { hours: { weekday: number; startMinute: number; endMinute: number }[] };
      res.json(await pros.setWorkingHours(req.actor!, id, hours));
    }),

    addTimeOff: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const body = req.body as { startAt: Date; endAt: Date; reason?: string | null };
      res.status(201).json(await pros.addTimeOff(req.actor!, id, body));
    }),

    removeTimeOff: asyncHandler(async (req, res) => {
      const { id, timeOffId } = timeOffParams.parse(req.params);
      await pros.removeTimeOff(req.actor!, id, timeOffId);
      res.status(204).end();
    }),
  };
}
