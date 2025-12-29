import { ResourceGraph } from '@/modules/resource-graph'

// Страница должна рендериться динамически, так как
// диапазон дат зависит от текущего времени
export const dynamic = 'force-dynamic'

export default function ResourceGraphPage() {
  return <ResourceGraph />
}
