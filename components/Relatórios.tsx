import React, { useMemo } from 'react';
import { Lead, LeadStatus } from '../types';
import { FileBarChart2, DollarSign, Percent, CreditCard, FileText, Shield, RefreshCw, Plus } from './Icons';

interface ReportsProps {
  leads: Lead[];
  renewed: Lead[];
}

export const Reports: React.FC<ReportsProps> = ({ leads, renewed }) => {
  // Filter only closed deals
  const closedLeads = useMemo(() => {
    const all = [...leads, ...renewed];
    return all.filter(l => l.status === LeadStatus.CLOSED && l.dealInfo);
  }, [leads, renewed]);

  // Helper to extract number of installments
  const getInstallments = (str?: string) => {
    if (!str) return 1;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  // CORE LOGIC: Calculate "TOTAL" based on Payment Method rules
  const calculateFinalCommission = (info: any) => {
      const premium = info.netPremium || 0;
      const commPct = info.commission || 0;
      const baseValue = premium * (commPct / 100);
      
      const method = (info.paymentMethod || '').toUpperCase();
      const inst = getInstallments(info.installments);

      // Rules applied to the Base Commission Value
      let finalValue = baseValue;

      if (method.includes('CARTÃO PORTO') || method.includes('CP') || method === 'CARTÃO PORTO SEGURO') {
          // CP: 1 to 12 -> Full Value
          finalValue = baseValue; 
      } else if (method.includes('CRÉDITO') || method.includes('CREDITO') || method === 'CC' || method === 'CARTÃO DE CRÉDITO') {
          // CC: 1-5 -> Full; 6-12 -> Divide by installments
          if (inst >= 6) finalValue = baseValue / inst;
      } else if (method.includes('DÉBITO') || method.includes('DEBITO')) {
          // Debito: 1-4 -> Full; 5-12 -> Divide
          if (inst >= 5) finalValue = baseValue / inst;
      } else if (method.includes('BOLETO')) {
          // Boleto: 1-3 -> Full; 4-12 -> Divide
          if (inst >= 4) finalValue = baseValue / inst;
      }

      return { baseValue, finalValue };
  };

  // Metrics Calculation
  const stats = useMemo(() => {
    const s = {
        new: { porto: 0, azul: 0, itau: 0, others: 0 },
        renewal: { porto: 0, azul: 0, itau: 0, others: 0 },
        totalPremium: 0,
        totalCommissionPctSum: 0,
        totalFinalCommission: 0, // Sum of the "TOTAL" column (after division logic)
        count: 0,
        renewalsCount: 0
    };

    closedLeads.forEach(lead => {
        const info = lead.dealInfo!;
        const insurer = (info.insurer || '').toLowerCase();
        const type = (lead.insuranceType || '').toLowerCase();
        const isRenewal = type.includes('renova') || lead.id.includes('renewed');

        // Counters
        const target = isRenewal ? s.renewal : s.new;
        if (insurer.includes('porto')) target.porto++;
        else if (insurer.includes('azul')) target.azul++;
        else if (insurer.includes('itau') || insurer.includes('itaú')) target.itau++;
        else target.others++;

        if (isRenewal) s.renewalsCount++;
        s.count++;

        // Financials
        s.totalPremium += info.netPremium || 0;
        s.totalCommissionPctSum += info.commission || 0;
        
        const { finalValue } = calculateFinalCommission(info);
        s.totalFinalCommission += finalValue;
    });

    return {
        ...s,
        avgTicket: s.count > 0 ? s.totalPremium / s.count : 0,
        avgCommissionPct: s.count > 0 ? s.totalCommissionPctSum / s.count : 0
    };
  }, [closedLeads]);

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const handleExport = () => {
    const fmtDate = (d?: string) => {
        if (!d) return '-';
        if (d.includes('-')) {
            const [y, m, day] = d.split('-');
            return `${day}/${m}/${y}`;
        }
        return d;
    };

    // Construct HTML Rows with Calculated Values
    const tableRows = closedLeads.map(lead => {
        const info = lead.dealInfo!;
        const { baseValue, finalValue } = calculateFinalCommission(info);
        
        // Using regex to simplify payment method for display
        let payMethodShort = info.paymentMethod || '-';
        if (payMethodShort.toUpperCase().includes('PORTO')) payMethodShort = 'CP';
        else if (payMethodShort.toUpperCase().includes('CRÉDITO')) payMethodShort = 'CC';

        return `
            <tr>
                <td>${lead.id}</td>
                <td>${fmtDate(info.endDate)}</td>
                <td>${lead.name}</td>
                <td>${info.insurer}</td>
                <td class="currency-fmt">${formatMoney(info.netPremium)}</td>
                <td class="number-fmt">${formatMoney(info.commission)}</td>
                <td class="currency-fmt">${formatMoney(baseValue)}</td> <!-- Coluna Comissao (R$) -->
                <td>${payMethodShort}</td>
                <td>${info.installments}</td>
                <td>${lead.cartaoPortoNovo ? 'SIM' : 'NÃO'}</td>
                <td class="currency-fmt" style="background-color: #e2efda; font-weight: bold;">${formatMoney(finalValue)}</td> <!-- TOTAL FINAL -->
            </tr>
        `;
    }).join('');

    const excelHTML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; font-family: Calibri, sans-serif; }
                td, th { border: 1px solid #d4d4d4; font-size: 11pt; vertical-align: middle; text-align: center; }
                .header-kpi { background-color: #D9E1F2; font-weight: bold; border: 1px solid #000; }
                .value-kpi { font-weight: bold; border: 1px solid #000; }
                .header-table { background-color: #4472C4; color: white; font-weight: bold; }
                .spacer { border: none; background: none; }
                .currency-fmt { mso-number-format:"R\$\ \#\,\#\#0\.00"; }
                .number-fmt { mso-number-format:"\#\,\#\#0\.00"; } 
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="4" class="header-kpi">RESUMO GERAL</td>
                    <td class="spacer"></td>
                    <td colspan="2" class="header-kpi">MÉDIAS</td>
                </tr>
                <tr>
                    <td>PREMIO LIQ. TOTAL</td> <td class="value-kpi currency-fmt">${formatMoney(stats.totalPremium)}</td>
                    <td class="spacer"></td>
                    <td>TOTAL COMISSÃO (FINAL)</td> <td class="value-kpi currency-fmt">${formatMoney(stats.totalFinalCommission)}</td>
                    <td class="spacer"></td>
                    <td>TICKET MÉDIO</td> <td class="value-kpi currency-fmt">${formatMoney(stats.avgTicket)}</td>
                </tr>
                 <tr>
                    <td>ITENS FECHADOS</td> <td class="value-kpi">${stats.count}</td>
                    <td class="spacer"></td>
                    <td>RENOVAÇÕES</td> <td class="value-kpi">${stats.renewalsCount}</td>
                    <td class="spacer"></td>
                    <td>COMISSÃO MÉDIA</td> <td class="value-kpi number-fmt">${formatMoney(stats.avgCommissionPct)}%</td>
                </tr>

                <tr><td colspan="10" class="spacer">&nbsp;</td></tr>

                <!-- DATA TABLE -->
                <thead>
                    <tr class="header-table">
                        <th>ID</th>
                        <th>VigenciaFinal</th>
                        <th>Nome Segurado</th>
                        <th>Seguradora</th>
                        <th>Premio Liquido</th>
                        <th>% Comissao</th>
                        <th>Comissao (R$)</th>
                        <th>Forma Pagto</th>
                        <th>Parcelamento</th>
                        <th>Cartao Porto Novo</th>
                        <th>TOTAL (Final)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([excelHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_Comissoes_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
       <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <FileBarChart2 className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-800">Relatório Financeiro & Comissões</h2>
                <p className="text-xs text-gray-500">Análise detalhada com regras de parcelamento</p>
             </div>
          </div>
          
          <button 
            onClick={handleExport}
            disabled={closedLeads.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Baixar Excel
          </button>
       </div>

       <div className="flex-1 overflow-y-auto pr-2">
           {/* KPI CARDS */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div>
                           <p className="text-xs font-bold text-gray-500 uppercase">Prêmio Liq. Total</p>
                           <p className="text-xl font-extrabold text-gray-900 mt-1">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalPremium)}
                           </p>
                       </div>
                       <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign className="w-5 h-5"/></div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2">Soma de todos os fechamentos</p>
               </div>

               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div>
                           <p className="text-xs font-bold text-gray-500 uppercase">Total Comissão (Final)</p>
                           <p className="text-xl font-extrabold text-green-700 mt-1">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalFinalCommission)}
                           </p>
                       </div>
                       <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign className="w-5 h-5"/></div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2">Após regras de parcelamento</p>
               </div>

               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div>
                           <p className="text-xs font-bold text-gray-500 uppercase">Ticket Médio</p>
                           <p className="text-xl font-extrabold text-gray-900 mt-1">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.avgTicket)}
                           </p>
                       </div>
                       <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><CreditCard className="w-5 h-5"/></div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2">Média do Prêmio Líquido</p>
               </div>

               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                       <div>
                           <p className="text-xs font-bold text-gray-500 uppercase">Média de Comissão</p>
                           <p className="text-xl font-extrabold text-gray-900 mt-1">
                               {stats.avgCommissionPct.toFixed(2)}%
                           </p>
                       </div>
                       <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Percent className="w-5 h-5"/></div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2">Média percentual geral</p>
               </div>
           </div>

           {/* SEGURADORA BREAKDOWN */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               {/* NOVOS */}
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                        <Plus className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-gray-800">Seguros Novos</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-blue-50 rounded border border-blue-100">
                            <span className="text-[10px] font-bold text-blue-600 block">PORTO</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.new.porto}</span>
                        </div>
                        <div className="p-2 bg-cyan-50 rounded border border-cyan-100">
                            <span className="text-[10px] font-bold text-cyan-600 block">AZUL</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.new.azul}</span>
                        </div>
                        <div className="p-2 bg-orange-50 rounded border border-orange-100">
                            <span className="text-[10px] font-bold text-orange-600 block">ITAÚ</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.new.itau}</span>
                        </div>
                        <div className="p-2 bg-gray-50 rounded border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500 block">OUTRAS</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.new.others}</span>
                        </div>
                    </div>
               </div>

               {/* RENOVAÇÕES */}
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                        <RefreshCw className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-gray-800">Renovações</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-blue-50 rounded border border-blue-100">
                            <span className="text-[10px] font-bold text-blue-600 block">PORTO</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.renewal.porto}</span>
                        </div>
                        <div className="p-2 bg-cyan-50 rounded border border-cyan-100">
                            <span className="text-[10px] font-bold text-cyan-600 block">AZUL</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.renewal.azul}</span>
                        </div>
                        <div className="p-2 bg-orange-50 rounded border border-orange-100">
                            <span className="text-[10px] font-bold text-orange-600 block">ITAÚ</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.renewal.itau}</span>
                        </div>
                        <div className="p-2 bg-gray-50 rounded border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500 block">OUTRAS</span>
                            <span className="text-lg font-extrabold text-gray-800">{stats.renewal.others}</span>
                        </div>
                    </div>
               </div>
           </div>
       </div>
    </div>
  );
};
