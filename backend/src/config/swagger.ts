import swaggerUi from 'swagger-ui-express'
import { env } from './env.js'

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'APPCONTAGEM — Pizza do Fábio: Controle de Bebidas',
    version: '2.0.0',
    description: 'API para controle de estoque de bebidas com rastreabilidade completa e anti-desvio',
  },
  servers: [{ url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Desenvolvimento' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Autenticação e sessão' },
    { name: 'Usuários', description: 'Gestão de usuários' },
    { name: 'Produtos', description: 'Catálogo de bebidas' },
    { name: 'Estoque', description: 'Consulta de estoque atual' },
    { name: 'Movimentações', description: 'Entradas, saídas, perdas e transferências' },
    { name: 'Contagem', description: 'Sessões de conferência física de estoque' },
    { name: 'Pedidos', description: 'Pedidos de compra' },
    { name: 'Relatórios', description: 'Relatórios e analytics' },
  ],
  paths: {},
}

export const swaggerMiddleware = swaggerUi.serve
export const swaggerSetup = swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'APPCONTAGEM API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1a4731; }',
})
