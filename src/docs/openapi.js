/** OpenAPI 3.0 specification for rok-m-backend REST API. */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ROK Mental Health API',
    version: '1.0.0',
    description:
      'REST API освітньої платформи (Express + Sequelize + PostgreSQL). ' +
      'Контракт сумісний з існуючим фронтендом: `{ data, meta }` для контенту.',
  },
  servers: [{ url: '/api', description: 'API base path' }],
  tags: [
    { name: 'Auth', description: 'Реєстрація, логін, профіль' },
    { name: 'Content', description: 'Методики, секції, ціни (публічні)' },
    { name: 'Tariffs', description: 'Активація тарифів' },
    { name: 'Access', description: 'Доступ до розділів' },
    { name: 'MAK Cards', description: 'МАК-картки та обране' },
    { name: 'Payments', description: 'Оплата' },
    { name: 'Feedback', description: 'Зворотний звʼязок' },
    { name: 'Progress', description: 'Історія переглядів' },
    { name: 'Admin', description: 'Адмін-панель (роль admin)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          jwt: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          documentId: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          tariff: { type: 'string', nullable: true },
          role: { type: 'object' },
        },
      },
      ContentListResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object' } },
          meta: { type: 'object' },
        },
      },
      OkResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Реєстрація',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string', minLength: 3 },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT + user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Валідація' },
          409: { description: 'Конфлікт email/username' },
        },
      },
    },
    '/auth/local': {
      post: {
        tags: ['Auth'],
        summary: 'Логін (email або username)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: {
                  identifier: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT + user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Невірні облікові дані' },
        },
      },
    },
    '/auth/email/request-code': {
      post: {
        tags: ['Auth'],
        summary: 'Запит коду підтвердження email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OkResponse' } } } } },
      },
    },
    '/auth/email/verify-code': {
      post: {
        tags: ['Auth'],
        summary: 'Підтвердження email кодом',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  code: { type: 'string', minLength: 4, maxLength: 12 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT + user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
        },
      },
    },
    '/auth/password/request-code': {
      post: {
        tags: ['Auth'],
        summary: 'Запит коду скидання пароля',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/password/reset': {
      post: {
        tags: ['Auth'],
        summary: 'Скидання пароля',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  code: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Поточний профіль',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Профіль + methodSections' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/profile': {
      put: {
        tags: ['Auth'],
        summary: 'Оновлення профілю',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Оновлений user' } },
      },
    },
    '/method-sections': {
      get: {
        tags: ['Content'],
        summary: 'Список секцій методик',
        parameters: [
          { name: 'filters', in: 'query', schema: { type: 'string' }, description: 'Query filters (e.g. filters[slug][$eq]=...)' },
          { name: 'populate', in: 'query', schema: { type: 'string' } },
          { name: 'pagination[page]', in: 'query', schema: { type: 'integer' } },
          { name: 'pagination[pageSize]', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: '{ data, meta }', content: { 'application/json': { schema: { $ref: '#/components/schemas/ContentListResponse' } } } },
        },
      },
    },
    '/method-sections/{id}': {
      get: {
        tags: ['Content'],
        summary: 'Секція за id',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'populate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: '{ data }' } },
      },
    },
    '/methods': {
      get: {
        tags: ['Content'],
        summary: 'Список методик',
        parameters: [
          { name: 'filters[slug][$eq]', in: 'query', schema: { type: 'string' } },
          { name: 'populate', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: '{ data, meta }', content: { 'application/json': { schema: { $ref: '#/components/schemas/ContentListResponse' } } } },
        },
      },
    },
    '/methods/{id}': {
      get: {
        tags: ['Content'],
        summary: 'Методика за id',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'populate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: '{ data }' } },
      },
    },
    '/pricing': {
      get: {
        tags: ['Content'],
        summary: 'Поточні ціни',
        responses: { 200: { description: '{ data }' } },
      },
    },
    '/tariffs/medium/activate': {
      post: {
        tags: ['Tariffs'],
        summary: 'Активація Medium (оплата або payment_required)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Активовано або payment_required' } },
      },
    },
    '/tariffs/premium/activate': {
      post: {
        tags: ['Tariffs'],
        summary: 'Активація Premium',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Активовано або payment_required' } },
      },
    },
    '/user-method-sections/assign': {
      post: {
        tags: ['Access'],
        summary: 'Призначити доступ до розділу',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['methodSectionId'],
                properties: {
                  methodSectionId: { type: 'integer' },
                  categorySlug: { type: 'string' },
                  methodicSlug: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK або payment_required' } },
      },
    },
    '/user-method-sections/me': {
      get: {
        tags: ['Access'],
        summary: 'Мої розділи',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список доступів' } },
      },
    },
    '/mak-cards/access': {
      post: {
        tags: ['MAK Cards'],
        summary: 'Запит доступу до МАК-карток',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK або payment_required' } },
      },
    },
    '/mak-cards/favorites': {
      get: {
        tags: ['MAK Cards'],
        summary: 'Список обраних карток',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Favorites' } },
      },
      put: {
        tags: ['MAK Cards'],
        summary: 'Замінити список обраних',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cardIds'],
                properties: { cardIds: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/mak-cards/favorites/toggle': {
      post: {
        tags: ['MAK Cards'],
        summary: 'Перемкнути обрану картку',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cardId'],
                properties: { cardId: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/payments/status': {
      get: {
        tags: ['Payments'],
        summary: 'Статус оплати',
        parameters: [{ name: 'orderReference', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Статус платежу' } },
      },
    },
    '/payments/confirm': {
      post: {
        tags: ['Payments'],
        summary: 'Підтвердження оплати (mock/demo)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderReference'],
                properties: { orderReference: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Підтверджено' } },
      },
    },
    '/feedback': {
      post: {
        tags: ['Feedback'],
        summary: 'Надіслати зворотний звʼязок',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'message'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  message: { type: 'string' },
                  tariff: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Створено' }, 400: { description: 'Валідація (укр.)' } },
      },
    },
    '/progress/methods/{methodId}/view': {
      post: {
        tags: ['Progress'],
        summary: 'Зафіксувати перегляд методики',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'methodId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/progress/me': {
      get: {
        tags: ['Progress'],
        summary: 'Історія переглядів',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Progress list' } },
      },
    },
    '/admin/payments/confirm': {
      post: {
        tags: ['Admin'],
        summary: 'Підтвердити оплату (manual)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderReference'],
                properties: { orderReference: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/feedbacks': {
      get: {
        tags: ['Admin'],
        summary: 'Список feedback',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Feedbacks' } },
      },
    },
    '/admin/feedbacks/{id}/processed': {
      patch: {
        tags: ['Admin'],
        summary: 'Позначити feedback обробленим',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/pricing': {
      get: {
        tags: ['Admin'],
        summary: 'Ціни (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Pricing' } },
      },
      put: {
        tags: ['Admin'],
        summary: 'Оновити ціни',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Список користувачів',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Users' } },
      },
    },
    '/admin/users/{id}/tariff': {
      patch: {
        tags: ['Admin'],
        summary: 'Змінити тариф користувача',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { tariff: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/method-sections': {
      get: {
        tags: ['Admin'],
        summary: 'Секції (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Sections' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Створити секцію',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/admin/method-sections/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Оновити секцію',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/methods': {
      get: {
        tags: ['Admin'],
        summary: 'Методики (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Methods' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Створити методику',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/admin/methods/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Оновити методику',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'OK' } },
      },
    },
  },
};
