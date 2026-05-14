# ARCHITECTURE - APPCONTAGEM

## Visão Geral
ERP operacional de controle de estoque de bebidas. Gerencia entradas, saídas, perdas, transferências Bar↔Delivery, contagem física e relatórios.

# MODULES
- auth
- usuarios
- produtos
- estoque
- movimentacoes
- contagem
- pedidos
- relatorios
- cmv

# PRINCIPLES
- Module isolation
- Service-oriented backend
- RTK Query for remote state

## Stack Tecnológica
- **Mobile**: React Native (Expo managed) + TypeScript
- **State/Requests**: Redux Toolkit + RTK Query (baseApi com autocache)
- **Backend**: Node.js + TypeScript + Express 5
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (PIN + biometria)
- **Build**: EAS Build

## API Base URL
Configurada em `mobile/src/config/api.ts` via `EXPO_PUBLIC_API_URL`.
Default dev: `http://192.168.15.164:3333/api/v1`

## Comandos Dev
```bash
# Backend
cd backend && npm run dev
cd backend && npm run prisma:studio
cd backend && npm run prisma:migrate

# Mobile
cd mobile && npx expo start
```
