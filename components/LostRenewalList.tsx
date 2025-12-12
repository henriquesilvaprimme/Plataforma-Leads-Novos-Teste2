
import React, { useState, useEffect } from 'react';
import { Lead, LeadStatus, User, DealInfo } from '../types';
import { Car, Phone, Calendar, DollarSign, Percent, CreditCard, Users, FileX, Search, Shield, Bell, AlertTriangle } from './Icons';

interface LostRenewalListProps {
  leads: Lead[];
  users: User[];
  onUpdateLead: (lead: Lead) => void;
  currentUser: User | null;
}

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/')) return dateString;
    if (dateString.includes('-')) {
        try {
            const date = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
            return date.toLocaleDateString('pt-BR');
        } catch (e) { return dateString; }
    }
    return dateString;
};

const formatCreationDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/')) return dateString;
    try {
        return new Date(dateString).toLocaleDateString('pt-BR');
    } catch (e) { return dateString; }
};

const LostRenewalCard: React.FC<{ lead: Lead, users: User[], onUpdate: (l: Lead) => void, currentUser: User | null }> = ({ lead, users, onUpdate, currentUser }) => {
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<LeadStatus>(lead.status); 
    const [observation, setObservation] = useState<string>(lead.notes || '');

    const isAdmin = currentUser?.isAdmin;

    useEffect(() => {
        setObservation(lead.notes || '');
        setSelectedStatus(lead.status);
    }, [lead]);

    const handleConfirmStatus = () => {
        if (selectedStatus !== LeadStatus.LOST) {
            if(confirm("Deseja realmente reativar este lead? Ele sairá desta lista.")) {
                const updatedLead = {
                    ...lead,
                    status: selectedStatus,
                    notes: observation
                };
                onUpdate(updatedLead);
                setIsEditingStatus(false);
            }
        } else {
             // Just updating notes if status is still LOST
             const updatedLead = { ...lead, notes: observation };
             onUpdate(updatedLead);
             setIsEditingStatus(false);
        }
    };

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm transition-all duration-300 w-full text-sm relative flex flex-col p-2">
            <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5 w-full pr-6 relative">
                        <div className="flex items-center flex-wrap gap-2">
                            <h3 className="font-bold text-base text-gray-900 leading-tight">{lead.name}</h3>
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-red-100 text-red-800 border-red-200">
                                {lead.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-0.5 text-gray-800 text-xs">
                    <div className="flex items-center gap-2">
                        <Car className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-900">{lead.vehicleModel}</span>
                        <span className="text-[10px] text-gray-500">({lead.vehicleYear})</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-gray-700">{lead.phone}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-gray-700 font-medium">Seguradora: 
                            <span className="text-gray-900 ml-1">{lead.dealInfo?.insurer || '-'}</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-red-400 shrink-0" />
                        <span className="text-gray-700 text-[10px] uppercase font-bold">Vigência Final:</span>
                        <span className="text-red-700 font-bold text-[10px] bg-red-50 px-1.5 rounded border border-red-100">
                            {formatDisplayDate(lead.dealInfo?.endDate)}
                        </span>
                    </div>

                    <div className="mt-2 bg-white p-2 rounded border border-red-100">
                        {isEditingStatus ? (
                            <div className="flex flex-col gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">
                                        Alterar Status
                                    </label>
                                    <select 
                                        className="w-full bg-white border border-gray-300 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm font-medium text-gray-700"
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value as LeadStatus)}
                                    >
                                        {Object.values(LeadStatus).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 block">
                                        Observações
                                    </label>
                                    <textarea 
                                        className="w-full border rounded px-2 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                                        value={observation}
                                        onChange={(e) => setObservation(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button 
                                        onClick={() => setIsEditingStatus(false)}
                                        className="px-3 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleConfirmStatus}
                                        className="px-3 py-1 rounded text-xs font-bold bg-green-600 text-white border border-green-700 hover:bg-green-700"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500 italic truncate max-w-[70%]">
                                    {lead.notes || 'Sem observações.'}
                                </span>
                                <button 
                                    onClick={() => setIsEditingStatus(true)}
                                    className="text-[10px] font-bold text-blue-600 hover:underline"
                                >
                                    Editar / Recuperar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-0.5 pt-1 border-t border-red-200 mt-1">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3 h-3" /> Responsável
                        </label>
                        <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded border border-red-100 w-fit max-w-full">
                            <span className="text-xs font-bold text-gray-700 truncate">
                                Atribuído para: <span className="text-indigo-700">{lead.assignedTo || 'Ninguém'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LostRenewalList: React.FC<LostRenewalListProps> = ({ leads, users, onUpdateLead, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState<string>(LeadStatus.LOST);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterDate, filterStatus]);

    const filteredLeads = leads.filter(lead => {
        // CRITÉRIOS OBRIGATÓRIOS: Renovação Primme + Perdido
        // Nota: O filtro visual 'filterStatus' deve ser 'Perdido' para mostrar algo, 
        // mas se o usuário mudar o filtro, a lista ficará vazia pois a coleção é filtrada para mostrar "Renovações Perdidas".
        // Para consistência com a "sessão", forçamos a exibição apenas dos Perdidos.
        
        const isRenovacaoPrimme = lead.insuranceType === 'Renovação Primme';
        const isLost = lead.status === LeadStatus.LOST;

        if (!isRenovacaoPrimme || !isLost) {
            return false;
        }

        const term = searchTerm.toLowerCase();
        const name = lead.name || '';
        const phone = lead.phone || '';
        const matchesSearch = name.toLowerCase().includes(term) || phone.includes(term);

        // O filtro de visualização 'filterStatus' aqui serve apenas para confirmar que o usuário quer ver os perdidos.
        // Se ele selecionar outro status no dropdown, a lista aparecerá vazia, o que é o comportamento esperado de um filtro.
        const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;

        let matchesDate = true;
        if (filterDate) {
            const endDate = lead.dealInfo?.endDate || '';
            matchesDate = endDate.startsWith(filterDate);
        }

        // Somente Admin vê tudo. Outros veem apenas o que lhes foi atribuído
        const isAssignedToUser = !currentUser || currentUser.isAdmin || lead.assignedTo === currentUser.name; 

        return matchesSearch && matchesStatus && matchesDate && isAssignedToUser;
    }).sort((a, b) => {
         const dateA = a.dealInfo?.endDate ? new Date(a.dealInfo.endDate).getTime() : 0;
         const dateB = b.dealInfo?.endDate ? new Date(b.dealInfo.endDate).getTime() : 0;
         return dateA - dateB || 0;
    });

    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                        <FileX className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Renovações Perdidas</h2>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 flex-wrap">
                    <div className="relative flex-grow md:flex-grow-0 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                          type="text" 
                          placeholder="Nome ou Telefone..." 
                          className="pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500 w-full"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <input 
                        type="month"
                        className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white text-gray-700"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />

                    <select 
                        className="border border-gray-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white cursor-pointer text-gray-700"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        {Object.values(LeadStatus).map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-4 pb-4 overflow-y-auto w-full px-1 flex-1">
                {paginatedLeads.map((lead) => (
                    <LostRenewalCard 
                        key={lead.id} 
                        lead={lead} 
                        users={users}
                        onUpdate={onUpdateLead} 
                        currentUser={currentUser}
                    />
                ))}

                {paginatedLeads.length === 0 && (
                    <div className="py-10 text-center text-gray-500 bg-white rounded-lg border-2 border-dashed border-gray-300">
                        <FileX className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium">Nenhuma renovação perdida encontrada para os critérios.</p>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 py-4 bg-white border-t border-gray-200 mt-auto">
                    <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 hover:bg-gray-50 text-gray-700">Anterior</button>
                    <span className="text-sm text-gray-600 font-medium">Página {currentPage} de {totalPages}</span>
                    <button onClick={handleNextPage} disabled={currentPage === totalPages} className="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 hover:bg-gray-50 text-gray-700">Próximo</button>
                </div>
            )}
        </div>
    );
};
