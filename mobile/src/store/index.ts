import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { AppState } from 'react-native'
import { baseApi } from './api/baseApi'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
})

// React Native: dispara onFocus quando app volta a ficar ativo
setupListeners(store.dispatch, (dispatch, { onFocus, onFocusLost }) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') dispatch(onFocus())
    else dispatch(onFocusLost())
  })
  return () => sub.remove()
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
