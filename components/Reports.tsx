
import React, { useMemo, useState } from 'react';
import { Lead, LeadStatus } from '../types';
// Added Plus to the imports list from ./Icons
import { FileBarChart2, DollarSign, Shield, Calendar, Search, CheckCircle, ChevronLeft, ChevronRight, Percent, Users, Plus } from './Icons';

interface ReportsProps {
  leads: Lead[];
  renewed: Lead[];
  renewals?: Lead[]; 
  onUpdateLead?: (lead: Lead) => void;
}

type ReportTab = 'PRODUCTION' | 'PAID_INSURANCES';

export const Reports: React.FC<ReportsProps> = ({ leads, renewed, renewals = [], onUpdateLead }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('PRODUCTION');
  
  // Filtros da Sessão Produção
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 7));
  
  // Filtros da Sessão Seguros Pagos
  const [filterDatePaid, setFilterDatePaid] = useState(() => new Date().toISOString().slice(0, 7));
  const [searchTermPaid, setSearchTermPaid] = useState('');

  const getInstallments = (str?: string) => {
    if (!str) return 1;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  const calculateFinalCommission = (netPremium: number, commissionPct: number, paymentMethod: string, installmentsStr: string) => {
      const premium = netPremium || 0;
      const commPct = commissionPct || 0;
      const baseValue = premium * (commPct / 100);
      
      const method = (paymentMethod || '').toUpperCase();
      const inst = getInstallments(installmentsStr);

      let finalValue = baseValue;

      if (method.includes('CARTÃO PORTO') || method.includes('CP') || method === 'CARTÃO PORTO SEGURO') {
          finalValue = baseValue; 
      } else if (method.includes('CRÉDITO') || method.includes('CREDITO') || method === 'CC' || method === 'CARTÃO DE CRÉDITO') {
          if (inst >= 6) finalValue = baseValue / inst;
      } else if (method.includes('DÉBITO') || method.includes('DEBITO')) {
          if (inst >= 5) finalValue = baseValue / inst;
      } else if (method.includes('BOLETO')) {
          if (inst >= 4) finalValue = baseValue / inst;
      }

      finalValue = finalValue * 0.85;

      return { baseValue, finalValue };
  };

  // Itens para o Relatório de Produção (Sessão 1)
  const productionItems = useMemo(() => {
    const items: any[] = [];
    const allLeads = [...leads, ...renewed, ...renewals];
    const seenIds = new Set();
    const uniqueLeads = allLeads.filter(l => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
    });

    uniqueLeads.forEach(lead => {
        if (lead.status === LeadStatus.CLOSED && lead.dealInfo) {
            const dateToCheck = lead.dealInfo.startDate || lead.closedAt || '';
            let normalizedDate = dateToCheck;
            if (dateToCheck.includes('/')) {
                 const [d, m, y] = dateToCheck.split('/');
                 normalizedDate = `${y}-${m}-${d}`;
            }

            if (normalizedDate.startsWith(filterDate)) {
                 items.push({
                     type: 'SALE',
                     subtype: lead.insuranceType || 'Novo',
                     leadName: lead.name,
                     phone: lead.phone,
                     insurer: lead.dealInfo.insurer,
                     netPremium: lead.dealInfo.netPremium,
                     commissionPct: lead.dealInfo.commission,
                     installments: lead.dealInfo.installments,
                     paymentMethod: lead.dealInfo.paymentMethod,
                     startDate: lead.dealInfo.startDate,
                     collaborator: lead.assignedTo || 'Não informado',
                     id: lead.id,
                     originalLead: lead
                 });
            }
        }
    });

    return items;
  }, [leads, renewed, renewals, filterDate]);

  // Itens para a Sessão de Seguros Pagos (Sessão 2)
  const paidItems = useMemo(() => {
    const allItems = [...leads, ...renewed]; 
    const term = searchTermPaid.toLowerCase();
    const seenIds = new Set();
    
    return allItems
      .filter(lead => {
        if (seenIds.has(lead.id)) return false;
        const isClosed = lead.status === LeadStatus.CLOSED && !!lead.dealInfo;
        if (!isClosed) return false;

        const name = (lead.name || '').toLowerCase();
        const phone = (lead.phone || '');
        const matchesSearch = name.includes(term) || phone.includes(term);
        
        const startDate = lead.dealInfo?.startDate || '';
        let normalizedDate = startDate;
        if (startDate.includes('/')) {
            const [d, m, y] = startDate.split('/');
            normalizedDate = `${y}-${m}-${d}`;
        }
        const matchesDate = normalizedDate.startsWith(filterDatePaid);

        if (matchesSearch && matchesDate) {
            seenIds.add(lead.id);
            return true;
        }
        return false;
      })
      .map(lead => {
          const { finalValue } = calculateFinalCommission(
            lead.dealInfo!.netPremium, 
            lead.dealInfo!.commission, 
            lead.dealInfo!.paymentMethod, 
            lead.dealInfo!.installments
          );
          return {
            ...lead,
            commissionValue: finalValue
          };
      });
  }, [leads, renewed, searchTermPaid, filterDatePaid]);

  const metrics = useMemo(() => {
    const data = {
        general: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
        new: { premium: 0, commission: 0, count: 0, commPctSum: 0, insurers: { porto: 0, azul: 0, itau: 0, others: 0 } },
        renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0, insurers: { porto: 0, azul: 0, itau: 0, others: 0 } }
    };

    productionItems.forEach(item => {
        const { finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
        
        data.general.premium += item.netPremium || 0;
        data.general.commission += finalValue;
        data.general.count++;
        data.general.commPctSum += item.commissionPct || 0;

        let target;
        // Definimos 'Renovação Primme' como o subtipo específico
        if (item.subtype === 'Renovação Primme') {
            target = data.renewal;
        } else {
            target = data.new;
        }

        if (target) {
            target.premium += item.netPremium || 0;
            target.commission += finalValue;
            target.count++;
            target.commPctSum += item.commissionPct || 0;

            const insurer = (item.insurer || '').toLowerCase();
            if (insurer.includes('porto')) target.insurers.porto++;
            else if (insurer.includes('azul')) target.insurers.azul++;
            else if (insurer.includes('itau') || insurer.includes('itaú')) target.insurers.itau++;
            else target.insurers.others++;
        }
    });

    return data;
  }, [productionItems]);

  const toggleCheck = (lead: Lead, field: 'commissionPaid' | 'commissionCP') => {
      if (!onUpdateLead) return;
      const updated = { ...lead, [field]: !lead[field] };
      onUpdateLead(updated);
  };

  const getAvg = (val: number, count: number) => count > 0 ? val / count : 0;
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-4">
       
       {/* HEADER DE NAVEGAÇÃO */}
       <div className="flex flex-col md:flex-row items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm gap-4">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${activeTab === 'PRODUCTION' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {activeTab === 'PRODUCTION' ? <FileBarChart2 className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-800">
                    {activeTab === 'PRODUCTION' ? 'Relatórios de Produção' : 'Relatórios de Seguros Pagos'}
                </h2>
                <p className="text-xs text-gray-500">
                    {activeTab === 'PRODUCTION' ? 'Financeiro e Controle de Produção' : 'Controle de Baixa de Comissões'}
                </p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <button 
                    onClick={() => setActiveTab(activeTab === 'PAID_INSURANCES' ? 'PRODUCTION' : 'PAID_INSURANCES')}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-xs text-gray-700 w-32 text-center uppercase tracking-wide">
                    {activeTab === 'PRODUCTION' ? 'Produção' : 'Seguros Pagos'}
                </span>
                <button 
                    onClick={() => setActiveTab(activeTab === 'PAID_INSURANCES' ? 'PRODUCTION' : 'PAID_INSURANCES')}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input 
                    type="month" 
                    value={activeTab === 'PRODUCTION' ? filterDate : filterDatePaid}
                    onChange={(e) => activeTab === 'PRODUCTION' ? setFilterDate(e.target.value) : setFilterDatePaid(e.target.value)}
                    className="text-sm font-medium text-gray-700 outline-none bg-transparent cursor-pointer"
                  />
              </div>
          </div>
       </div>

       {/* CONTEÚDO DINÂMICO */}
       <div className="flex-1 overflow-y-auto space-y-6 pb-6">
           
           {activeTab === 'PRODUCTION' && (
               <>
                {/* RESUMO GERAL */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2 px-1">
                        <Shield className="w-4 h-4" /> Resumo do Período
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 rounded-xl shadow-lg text-white">
                            <p className="text-xs font-medium text-indigo-100 uppercase">Prêmio Líquido Total</p>
                            <p className="text-2xl font-bold mt-1">{formatMoney(metrics.general.premium)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 rounded-xl shadow-lg text-white">
                            <p className="text-xs font-medium text-emerald-100 uppercase">Comissão Total (Final 85%)</p>
                            <p className="text-2xl font-bold mt-1">{formatMoney(metrics.general.commission)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Itens Produzidos</p>
                            <p className="text-3xl font-extrabold text-gray-800 mt-1">{metrics.general.count}</p>
                        </div>
                    </div>
                </section>

                {/* DETALHAMENTO POR TIPO (AS INFORMAÇÕES QUE HAVIAM ANTES) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* SEGURO NOVO (Inclui Mercado) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                            <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Seguro Novo / Renovação Mercado
                            </h4>
                            <span className="bg-indigo-600 text-white text-xs font-extrabold px-2 py-1 rounded-lg">{metrics.new.count} Itens</span>
                        </div>
                        <div className="p-5 space-y-4 flex-1">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Prêmio Líquido</p>
                                    <p className="text-lg font-bold text-gray-800">{formatMoney(metrics.new.premium)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Comissão Líquida</p>
                                    <p className="text-lg font-bold text-emerald-600">{formatMoney(metrics.new.commission)}</p>
                                </div>
                             </div>
                             <div className="border-t border-gray-100 pt-4">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Breakdown Seguradoras</p>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Porto</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.new.insurers.porto}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Azul</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.new.insurers.azul}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Itaú</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.new.insurers.itau}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Outras</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.new.insurers.others}</span>
                                    </div>
                                </div>
                             </div>
                             <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-bold text-gray-600 uppercase">Média Comissão</span>
                                </div>
                                <span className="font-bold text-indigo-700">{getAvg(metrics.new.commPctSum, metrics.new.count).toFixed(1)}%</span>
                             </div>
                        </div>
                    </div>

                    {/* RENOVAÇÕES PRIMME */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                            <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Renovação Primme
                            </h4>
                            <span className="bg-emerald-600 text-white text-xs font-extrabold px-2 py-1 rounded-lg">{metrics.renewal.count} Itens</span>
                        </div>
                        <div className="p-5 space-y-4 flex-1">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Prêmio Líquido</p>
                                    <p className="text-lg font-bold text-gray-800">{formatMoney(metrics.renewal.premium)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Comissão Líquida</p>
                                    <p className="text-lg font-bold text-emerald-600">{formatMoney(metrics.renewal.commission)}</p>
                                </div>
                             </div>
                             <div className="border-t border-gray-100 pt-4">
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Breakdown Seguradoras</p>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Porto</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.renewal.insurers.porto}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Azul</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.renewal.insurers.azul}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Itaú</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.renewal.insurers.itau}</span>
                                    </div>
                                    <div className="text-center bg-gray-50 p-2 rounded border border-gray-100">
                                        <span className="block text-[10px] text-gray-500 font-bold uppercase">Outras</span>
                                        <span className="text-sm font-bold text-gray-700">{metrics.renewal.insurers.others}</span>
                                    </div>
                                </div>
                             </div>
                             <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-bold text-gray-600 uppercase">Média Comissão</span>
                                </div>
                                <span className="font-bold text-emerald-700">{getAvg(metrics.renewal.commPctSum, metrics.renewal.count).toFixed(1)}%</span>
                             </div>
                        </div>
                    </div>
                </div>
               </>
           )}

           {activeTab === 'PAID_INSURANCES' && (
               <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col animate-fade-in">
                   <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                           <DollarSign className="w-5 h-5 text-blue-600" />
                           <h3 className="font-bold text-gray-800">Pesquisar Seguros Pagos</h3>
                       </div>
                       
                       <div className="relative w-full md:w-80">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                           <input 
                               type="text" 
                               placeholder="Nome ou Telefone..."
                               value={searchTermPaid}
                               onChange={(e) => setSearchTermPaid(e.target.value)}
                               className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                           />
                       </div>
                   </div>

                   <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                           <thead className="bg-gray-50">
                               <tr>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b">Vigência</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b">Nome</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b">Seguradora</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b">Prêmio Líquido</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b text-center">% Com.</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b">Comissão Liq.</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase border-b text-center">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {paidItems.map(lead => (
                                   <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                       <td className="px-4 py-3 text-xs font-medium text-gray-600 whitespace-nowrap">
                                           {lead.dealInfo?.startDate ? new Date(lead.dealInfo.startDate).toLocaleDateString('pt-BR') : '-'}
                                       </td>
                                       <td className="px-4 py-3 text-xs font-bold text-gray-900">{lead.name}</td>
                                       <td className="px-4 py-3 text-xs text-gray-700">{lead.dealInfo?.insurer}</td>
                                       <td className="px-4 py-3 text-xs font-bold text-gray-900">{formatMoney(lead.dealInfo?.netPremium || 0)}</td>
                                       <td className="px-4 py-3 text-xs font-bold text-indigo-600 text-center">{lead.dealInfo?.commission}%</td>
                                       <td className="px-4 py-3 text-xs font-bold text-green-700">{formatMoney(lead.commissionValue || 0)}</td>
                                       <td className="px-4 py-3">
                                           <div className="flex items-center justify-center gap-2">
                                               <button 
                                                    onClick={() => toggleCheck(lead, 'commissionPaid')}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${lead.commissionPaid ? 'bg-green-600 text-white border-green-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-green-500 hover:text-green-600'}`}
                                               >
                                                    <CheckCircle className="w-3 h-3" /> PAGA
                                               </button>
                                               <button 
                                                    onClick={() => toggleCheck(lead, 'commissionCP')}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${lead.commissionCP ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-blue-500 hover:text-blue-600'}`}
                                               >
                                                    <DollarSign className="w-3 h-3" /> CP
                                               </button>
                                           </div>
                                       </td>
                                   </tr>
                               ))}
                               {paidItems.length === 0 && (
                                   <tr>
                                       <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm italic">
                                           Nenhum registro encontrado para os filtros selecionados.
                                       </td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </section>
           )}
       </div>
    </div>
  );
};
