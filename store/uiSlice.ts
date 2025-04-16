import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  loading: boolean
  notification: string | null
}

const initialState: UIState = {
  loading: false,
  notification: null,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setNotification(state, action: PayloadAction<string | null>) {
      state.notification = action.payload
    },
    clearNotification(state) {
      state.notification = null
    },
  },
})

export const { setLoading, setNotification, clearNotification } = uiSlice.actions
export default uiSlice.reducer 