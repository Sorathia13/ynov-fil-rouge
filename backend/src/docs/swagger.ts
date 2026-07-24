/**
 * OpenAPI 3 specification served via Swagger UI at /api/docs.
 * The document is authored as a typed definition and normalised by swagger-jsdoc.
 */
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const errorResponse = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    },
  },
};

const definition: swaggerJsdoc.Options['definition'] = {
  openapi: '3.0.3',
  info: {
    title: 'SmartBooking API',
    version: '1.0.0',
    description:
      'API de la plateforme SmartBooking — gestion intelligente de rendez-vous. ' +
      'Projet RNCP 39583, Bloc 2. Authentification JWT (Bearer) + refresh token rotatif.',
  },
  servers: [{ url: '/api', description: 'API base path' }],
  tags: [
    { name: 'Auth', description: 'Inscription, connexion, rafraîchissement de session' },
    { name: 'Users', description: 'Profil utilisateur et administration' },
    { name: 'Professionals', description: 'Profils pros, horaires, congés, prestations' },
    { name: 'Appointments', description: 'Disponibilités et gestion des rendez-vous' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: errorResponse,
      PublicUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['CLIENT', 'PRO', 'ADMIN'] },
          isActive: { type: 'boolean' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/PublicUser' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          accessTokenExpiresIn: { type: 'integer' },
        },
      },
      Slot: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
        },
      },
      AvailabilityResponse: {
        type: 'object',
        properties: {
          available: { type: 'boolean' },
          reason: {
            type: 'string',
            enum: ['PAST', 'LEAD_TIME', 'OUTSIDE_WORKING_HOURS', 'TIME_OFF', 'CONFLICT'],
          },
          requested: { $ref: '#/components/schemas/Slot' },
          alternatives: { type: 'array', items: { $ref: '#/components/schemas/Slot' } },
        },
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          professionalId: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
          serviceId: { type: 'string', format: 'uuid' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] },
          notes: { type: 'string', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Créer un compte',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string' },
                  role: { type: 'string', enum: ['CLIENT', 'PRO'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Compte créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } } } },
          409: { description: 'Email déjà utilisé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Se connecter',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Session ouverte', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } } } },
          401: { description: 'Identifiants invalides' },
        },
      },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Rafraîchir la session', security: [], responses: { 200: { description: 'Nouvelle session' }, 401: { description: 'Session invalide' } } },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Se déconnecter', security: [], responses: { 204: { description: 'Déconnecté' } } },
    },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Mon profil', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } } } } } },
      patch: { tags: ['Users'], summary: 'Mettre à jour mon profil', responses: { 200: { description: 'OK' } } },
    },
    '/professionals': {
      get: { tags: ['Professionals'], summary: 'Lister les professionnels', security: [], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Professionals'], summary: 'Créer mon profil professionnel', responses: { 201: { description: 'Créé' } } },
    },
    '/appointments/slots': {
      get: {
        tags: ['Appointments'],
        summary: 'Créneaux disponibles pour une prestation',
        parameters: [
          { name: 'professionalId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'serviceId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: { description: 'Liste de créneaux', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } } },
      },
    },
    '/appointments/availability': {
      post: {
        tags: ['Appointments'],
        summary: 'Vérifier un créneau précis + alternatives',
        responses: { 200: { description: 'Résultat', content: { 'application/json': { schema: { $ref: '#/components/schemas/AvailabilityResponse' } } } } },
      },
    },
    '/appointments': {
      post: {
        tags: ['Appointments'],
        summary: 'Réserver un rendez-vous',
        responses: {
          201: { description: 'Rendez-vous créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Appointment' } } } },
          409: { description: 'Créneau indisponible (avec alternatives)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/appointments/me': {
      get: { tags: ['Appointments'], summary: 'Mes rendez-vous', responses: { 200: { description: 'OK' } } },
    },
  },
};

export const openapiSpecification = swaggerJsdoc({ definition, apis: [] });

export function mountSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpecification));
}
