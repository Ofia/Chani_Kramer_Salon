import { createContext, useContext, useState } from 'react'

export type ViewingAs = 'owner' | 'bookkeeper' | 'front_desk' | 'sales'

interface ViewingAsCtx {
  viewingAs: ViewingAs
  setViewingAs: (r: ViewingAs) => void
}

const Ctx = createContext<ViewingAsCtx>({ viewingAs: 'owner', setViewingAs: () => {} })

export function ViewingAsProvider({ children }: { children: React.ReactNode }) {
  const [viewingAs, set] = useState<ViewingAs>(
    () => (localStorage.getItem('salon_viewing_as') as ViewingAs) ?? 'owner'
  )

  function setViewingAs(r: ViewingAs) {
    localStorage.setItem('salon_viewing_as', r)
    set(r)
  }

  return <Ctx.Provider value={{ viewingAs, setViewingAs }}>{children}</Ctx.Provider>
}

export function useViewingAs() {
  return useContext(Ctx)
}
