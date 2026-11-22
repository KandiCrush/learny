import { Binary, Boxes, Cpu, Database, GitBranch, HardDrive, Layers, MemoryStick, Network, ShieldCheck, Timer, Workflow } from 'lucide-react'
import type { IconKey } from './catalog'

export const ICONS: Record<IconKey, typeof Cpu> = {
  cpu: Cpu, network: Network, binary: Binary, database: Database, layers: Layers, memory: MemoryStick,
  timer: Timer, branch: GitBranch, shield: ShieldCheck, disk: HardDrive, boxes: Boxes, workflow: Workflow,
}
