/**
 * Ready-made agent teams: one lead, department managers under it and
 * workers under each manager, all Claude terminals wired on the canvas.
 *
 * The default is the full team — 1 Opus lead, 4 Sonnet managers, 20 Haiku
 * workers — organised as general-purpose departments (research, content,
 * data, operations), so it fits any kind of work, not one workflow.
 */

export const TEAM_MODELS = {
  lead: "claude-opus-5-5",
  manager: "claude-sonnet-5-5",
  worker: "claude-haiku-5-5",
} as const;

export interface TeamDepartment {
  manager: string;
  worker: string;
  managerRole: string;
  workerRole: string;
}

export const TEAM_DEPARTMENTS: TeamDepartment[] = [
  {
    manager: "Research Manager",
    worker: "Researcher",
    managerRole:
      "Araştırma ekibini yönetir: konu, pazar, rakip ve kişi/şirket araştırmasını böler, kaynaklı özetleri birleştirir",
    workerRole:
      "Verilen konuyu web ve kaynaklardan araştırır, kaynak linkleriyle kısa ve doğrulanmış özet döner",
  },
  {
    manager: "Content Manager",
    worker: "Writer",
    managerRole:
      "İçerik ekibini yönetir: e-posta, metin, sosyal medya ve doküman işlerini dağıtır, ton ve kaliteyi kontrol eder",
    workerRole:
      "İstenen metni yazar veya düzenler (e-posta, gönderi, doküman, çeviri), verilen tona ve formata uyar",
  },
  {
    manager: "Data Manager",
    worker: "Data",
    managerRole:
      "Veri ekibini yönetir: Sheet/CSV okuma-yazma, temizleme, zenginleştirme ve analiz işlerini dağıtır",
    workerRole:
      "Sheet/CSV verisini okur, temizler, zenginleştirir ve analiz eder; görev isterse satırları günceller",
  },
  {
    manager: "Ops Manager",
    worker: "Ops",
    managerRole:
      "Operasyon ekibini yönetir: n8n/API tetikleme, otomasyon, kod/script ve kontrol işlerini dağıtır",
    workerRole:
      "Otomasyon, script/kod ve entegrasyon işlerini yapar; n8n/API çağrılarını yürütür ve sonucu kontrol eder",
  },
];

export const LEAD_NAME = "Director";
export const LEAD_ROLE =
  "Ekibin lideri: kullanıcının komutunu alır, işi yöneticilere dağıtır, sonuçları birleştirir ve büyük işlerin sonunda rapor yazar";

export interface TeamTemplate {
  departments: TeamDepartment[];
  workersPerManager: number;
}

export const FULL_TEAM: TeamTemplate = {
  departments: TEAM_DEPARTMENTS,
  workersPerManager: 5,
};

export const SMALL_TEAM: TeamTemplate = {
  departments: TEAM_DEPARTMENTS.slice(0, 2),
  workersPerManager: 3,
};

export interface PlannedAgent {
  key: string;
  /** Key of the manager this agent reports to. */
  managerKey: string | null;
  tier: keyof typeof TEAM_MODELS;
  name: string;
  role: string;
  model: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SIZES = {
  lead: { width: 760, height: 460 },
  manager: { width: 640, height: 400 },
  worker: { width: 520, height: 330 },
};
const GAP = 24;
const ROW_GAP = 110;
const WORKER_COLUMNS = 2;
const DEPARTMENT_GAP = 90;

/**
 * Positions and wiring for a team, top-down: the lead centred above its
 * managers, each manager above a two-column grid of its workers.
 */
export function planTeam(
  template: TeamTemplate,
  origin: { x: number; y: number },
): PlannedAgent[] {
  const columnWidth =
    WORKER_COLUMNS * SIZES.worker.width + (WORKER_COLUMNS - 1) * GAP;
  const departments = template.departments.length;
  const totalWidth =
    departments * columnWidth + Math.max(0, departments - 1) * DEPARTMENT_GAP;
  const left = origin.x - totalWidth / 2;

  const plan: PlannedAgent[] = [
    {
      key: "lead",
      managerKey: null,
      tier: "lead",
      name: LEAD_NAME,
      role: LEAD_ROLE,
      model: TEAM_MODELS.lead,
      x: Math.round(origin.x - SIZES.lead.width / 2),
      y: Math.round(origin.y),
      ...SIZES.lead,
    },
  ];

  const managerY = origin.y + SIZES.lead.height + ROW_GAP;
  const workerY = managerY + SIZES.manager.height + ROW_GAP;
  template.departments.forEach((department, d) => {
    const columnX = left + d * (columnWidth + DEPARTMENT_GAP);
    const managerKey = `manager-${d + 1}`;
    plan.push({
      key: managerKey,
      managerKey: "lead",
      tier: "manager",
      name: department.manager,
      role: department.managerRole,
      model: TEAM_MODELS.manager,
      x: Math.round(columnX + (columnWidth - SIZES.manager.width) / 2),
      y: Math.round(managerY),
      ...SIZES.manager,
    });
    for (let w = 0; w < template.workersPerManager; w++) {
      const column = w % WORKER_COLUMNS;
      const row = Math.floor(w / WORKER_COLUMNS);
      plan.push({
        key: `${managerKey}-worker-${w + 1}`,
        managerKey,
        tier: "worker",
        name: `${department.worker} ${w + 1}`,
        role: department.workerRole,
        model: TEAM_MODELS.worker,
        x: Math.round(columnX + column * (SIZES.worker.width + GAP)),
        y: Math.round(workerY + row * (SIZES.worker.height + GAP)),
        ...SIZES.worker,
      });
    }
  });
  return plan;
}
