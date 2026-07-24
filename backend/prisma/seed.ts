/**
 * Idempotent seed for local development & demos.
 * Creates one admin, one professional (with schedule + services), one client,
 * and a sample confirmed appointment so dashboards are not empty.
 *
 * Demo credentials (password for all): Password123!
 *   admin@smartbooking.dev · pro@smartbooking.dev · client@smartbooking.dev
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/auth/password';
import { zonedDateParts, zonedWallTimeToUtc } from '../src/shared/time';

const prisma = new PrismaClient();
const TZ = 'Europe/Paris';

function nextWorkingDayAt(hourLocal: number): Date {
  const now = new Date();
  for (let i = 1; i <= 8; i++) {
    const probe = new Date(now.getTime() + i * 86_400_000);
    const parts = zonedDateParts(probe, TZ);
    if (parts.weekday >= 1 && parts.weekday <= 5) {
      return zonedWallTimeToUtc(parts.year, parts.month, parts.day, hourLocal * 60, TZ);
    }
  }
  return now;
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword('Password123!');

  await prisma.user.upsert({
    where: { email: 'admin@smartbooking.dev' },
    update: {},
    create: { email: 'admin@smartbooking.dev', passwordHash, firstName: 'Alice', lastName: 'Admin', role: 'ADMIN' },
  });

  const proUser = await prisma.user.upsert({
    where: { email: 'pro@smartbooking.dev' },
    update: {},
    create: { email: 'pro@smartbooking.dev', passwordHash, firstName: 'Bruno', lastName: 'Martin', role: 'PRO' },
  });

  const client = await prisma.user.upsert({
    where: { email: 'client@smartbooking.dev' },
    update: {},
    create: { email: 'client@smartbooking.dev', passwordHash, firstName: 'Chloé', lastName: 'Durand', role: 'CLIENT' },
  });

  const professional = await prisma.professional.upsert({
    where: { userId: proUser.id },
    update: {},
    create: {
      userId: proUser.id,
      businessName: 'Studio Coiffure Émeraude',
      bio: 'Salon de coiffure moderne au cœur de la ville. Coupe, coloration et soins.',
      timezone: TZ,
    },
  });

  // Weekly schedule: Mon–Fri, 09:00–12:00 and 13:30–18:00 (local time).
  await prisma.workingHours.deleteMany({ where: { professionalId: professional.id } });
  await prisma.workingHours.createMany({
    data: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { professionalId: professional.id, weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
      { professionalId: professional.id, weekday, startMinute: 13 * 60 + 30, endMinute: 18 * 60 },
    ]),
  });

  const serviceCount = await prisma.service.count({ where: { professionalId: professional.id } });
  if (serviceCount === 0) {
    await prisma.service.createMany({
      data: [
        { professionalId: professional.id, name: 'Coupe homme', durationMinutes: 30, priceCents: 2500, color: '#2563eb' },
        { professionalId: professional.id, name: 'Coupe + barbe', durationMinutes: 45, priceCents: 3500, color: '#16a34a' },
        { professionalId: professional.id, name: 'Coloration', durationMinutes: 90, priceCents: 6500, color: '#db2777' },
      ],
    });
  }

  const firstService = await prisma.service.findFirst({ where: { professionalId: professional.id } });
  const appointmentCount = await prisma.appointment.count({ where: { professionalId: professional.id } });
  if (firstService && appointmentCount === 0) {
    const startAt = nextWorkingDayAt(10);
    await prisma.appointment.create({
      data: {
        professionalId: professional.id,
        clientId: client.id,
        serviceId: firstService.id,
        startAt,
        endAt: new Date(startAt.getTime() + firstService.durationMinutes * 60_000),
        status: 'CONFIRMED',
        notes: 'Rendez-vous de démonstration',
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed completed: admin / pro / client (password: Password123!)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
