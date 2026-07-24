import { z } from 'zod';
import { AppointmentService } from '../../../application/appointment.service';
import { asyncHandler } from '../async-handler';
import { idParam } from '../validators/common.validators';
import {
  availabilitySchema,
  listAppointmentsQuery,
  slotsQuery,
} from '../validators/appointment.validators';

const professionalIdParam = z.object({ professionalId: z.string().uuid() });

export function appointmentController(appointments: AppointmentService) {
  return {
    slots: asyncHandler(async (req, res) => {
      const q = slotsQuery.parse(req.query);
      res.json(await appointments.listAvailableSlots(q.professionalId, q.serviceId, q.from, q.to));
    }),

    checkAvailability: asyncHandler(async (req, res) => {
      const body = availabilitySchema.parse(req.body);
      res.json(await appointments.checkAvailability(body.professionalId, body.serviceId, body.startAt));
    }),

    book: asyncHandler(async (req, res) => {
      const body = req.body as {
        professionalId: string;
        serviceId: string;
        startAt: Date;
        notes?: string | null;
      };
      res.status(201).json(await appointments.book(req.actor!.id, body));
    }),

    myAppointments: asyncHandler(async (req, res) => {
      const q = listAppointmentsQuery.parse(req.query);
      res.json(await appointments.listForClient(req.actor!.id, q));
    }),

    professionalAppointments: asyncHandler(async (req, res) => {
      const { professionalId } = professionalIdParam.parse(req.params);
      const q = listAppointmentsQuery.parse(req.query);
      res.json(await appointments.listForProfessional(req.actor!, professionalId, q));
    }),

    getById: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      res.json(await appointments.getById(req.actor!, id));
    }),

    reschedule: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { startAt } = req.body as { startAt: Date };
      res.json(await appointments.reschedule(req.actor!, id, startAt));
    }),

    updateStatus: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const { status } = req.body as {
        status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
      };
      res.json(await appointments.updateStatus(req.actor!, id, status));
    }),

    cancel: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      res.json(await appointments.cancel(req.actor!, id));
    }),
  };
}
