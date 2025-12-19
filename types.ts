
export enum LeadStatus {
  NEW = 'Novo',
  IN_CONTACT = 'Em Contato',
  NO_CONTACT = 'Sem Contato',
  SCHEDULED = 'Agendar',
  CLOSED = 'Fechado',
  LOST = 'Perdido'
}

export interface DealInfo {
  insurer: string;
  paymentMethod: string;
  netPremium: number;
  commission: number;
  installments: string;
  startDate: string;
  endDate: string;
}

export interface Endorsement {
  id: string;
  vehicleModel: string;
  vehicleYear: string;
  netPremium: number;
  commission: number;
  installments: string;
  startDate: string;
  createdAt: string;
  paymentMethod?: string;
}

export interface Lead {
  id: string;
  name: string;
  vehicleModel: string;
  vehicleYear: string;
  city: string;
  phone: string;
  insuranceType: string; // Ex: Compreensivo, Roubo/Furto, Terceiros
  status: LeadStatus;
  email: string;
  assignedTo?: string; // ID ou Nome do usuário
  notes: string;
  createdAt: string; // Data de criação do lead
  
  // Agendamento
  scheduledDate?: string;

  // Fechamento e Controle
  closedAt?: string;
  cartaoPortoNovo?: boolean;
  insurerConfirmed?: boolean;
  usuarioId?: string;
  registeredAt?: string;
  
  // Atribuição
  assignedAt?: string; // Data de atribuição

  // Controle Financeiro
  commissionPaid?: boolean;
  commissionCP?: boolean;

  // Dados do Fechamento (Novo)
  dealInfo?: DealInfo;
  
  // Endossos
  endorsements?: Endorsement[];

  // AI Fields
  aiScore?: number;
  aiAnalysis?: string;
  aiActionPlan?: string[];
}

export interface User {
  id: string;
  name: string;
  login: string;
  password?: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  isRenovations?: boolean; // Novo campo
  avatarColor?: string;
}

export interface AIAnalysisResult {
  score: number;
  summary: string;
  actionPlan: string[];
}

export const USERS_LIST = [
  "Henrique Silva",
  "João Comercial",
  "Maria Atendimento",
  "Carlos Vendas"
];
