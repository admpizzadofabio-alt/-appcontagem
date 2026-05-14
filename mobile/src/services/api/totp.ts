import { baseApi } from '../../store/api/baseApi'

export type TotpSetupResult = { secret: string; otpauthUrl: string }

export const totpApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    setupTotp: build.mutation<TotpSetupResult, void>({
      query: () => ({ url: '/auth/totp/setup', method: 'POST' }),
    }),
    enableTotp: build.mutation<{ ok: boolean }, { code: string }>({
      query: (data) => ({ url: '/auth/totp/enable', method: 'POST', data }),
    }),
    disableTotp: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/auth/totp/disable', method: 'POST' }),
    }),
  }),
  overrideExisting: false,
})

export const { useSetupTotpMutation, useEnableTotpMutation, useDisableTotpMutation } = totpApi
