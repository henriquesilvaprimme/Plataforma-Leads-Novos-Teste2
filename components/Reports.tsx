
import React, { useMemo, useState } from 'react';
import { Lead, LeadStatus } from '../types';
import { FileBarChart2, DollarSign, Percent, CreditCard, FileText, Shield, RefreshCw, Plus, Calendar } from './Icons';

interface ReportsProps {
  leads: Lead[];
  renewed: Lead[];
  renewals?: Lead[]; // Optional to support App changes
}

export const Reports: React.FC<ReportsProps> = ({ leads, renewed, renewals = [] }) => {
  // 1. Filter Date State (Default: Current Month)
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 7));

  // Helper to extract number of installments
  const getInstallments = (str?: string) => {
    if (!str) return 1;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  // Helper: Calculate Commission Logic based on Payment Method
  const calculateFinalCommission = (netPremium: number, commissionPct: number, paymentMethod: string, installmentsStr: string) => {
      const premium = netPremium || 0;
      const commPct = commissionPct || 0;
      const baseValue = premium * (commPct / 100);
      
      const method = (paymentMethod || '').toUpperCase();
      const inst = getInstallments(installmentsStr);

      // Rules applied to the Base Commission Value
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

      // Aplica regra de 85% sobre o valor final
      finalValue = finalValue * 0.85;

      return { baseValue, finalValue };
  };

  // 2. Aggregate all reportable items (Sales + Endorsements)
  const reportItems = useMemo(() => {
    const items: any[] = [];
    // Combine all sources
    const allLeads = [...leads, ...renewed, ...renewals];
    
    // Deduplicate if necessary (though collections should be distinct usually)
    const seenIds = new Set();
    const uniqueLeads = allLeads.filter(l => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
    });

    uniqueLeads.forEach(lead => {
        // A. Main Deal (Sale)
        // Check if Closed AND has DealInfo
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
                     insurer: lead.dealInfo.insurer,
                     netPremium: lead.dealInfo.netPremium,
                     commissionPct: lead.dealInfo.commission,
                     installments: lead.dealInfo.installments,
                     paymentMethod: lead.dealInfo.paymentMethod,
                     startDate: lead.dealInfo.startDate,
                     collaborator: lead.assignedTo || 'Não informado',
                     id: lead.id
                 });
            }
        }

        // B. Endorsements
        if (lead.endorsements && lead.endorsements.length > 0) {
            lead.endorsements.forEach((end, idx) => {
                const dateToCheck = end.startDate; // Endorsement Date
                let normalizedDate = dateToCheck;
                 if (dateToCheck.includes('/')) {
                     const [d, m, y] = dateToCheck.split('/');
                     normalizedDate = `${y}-${m}-${d}`;
                }

                if (normalizedDate.startsWith(filterDate)) {
                    items.push({
                        type: 'ENDORSEMENT',
                        subtype: 'Endosso',
                        leadName: lead.name,
                        insurer: lead.dealInfo?.insurer || 'Endosso', // Usually same insurer
                        netPremium: end.netPremium,
                        commissionPct: end.commission,
                        installments: end.installments,
                        paymentMethod: end.paymentMethod,
                        startDate: end.startDate,
                        collaborator: lead.assignedTo || 'Não informado',
                        id: `${lead.id}_END_${idx}`
                    });
                }
            });
        }
    });

    return items;
  }, [leads, renewed, renewals, filterDate]);

  // 3. Metrics Calculation
  const metrics = useMemo(() => {
    const data = {
        general: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
        new: { premium: 0, commission: 0, count: 0, commPctSum: 0, insurers: { porto: 0, azul: 0, itau: 0, others: 0 } },
        renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0, insurers: { porto: 0, azul: 0, itau: 0, others: 0 } }
    };

    reportItems.forEach(item => {
        const { finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
        
        // General Accumulation
        data.general.premium += item.netPremium || 0;
        data.general.commission += finalValue;
        
        // Exclude Endorsements from the general "Itens Produzidos" count per request
        if (item.type !== 'ENDORSEMENT') {
            data.general.count++;
            data.general.commPctSum += item.commissionPct || 0; // Keeping commission pct logic consistent with count
        }

        // Bucket Determination
        let target;
        // Logic change: Only "Renovação Primme" goes to Renewal bucket. Everything else (including standard Renovação) goes to New bucket.
        if (item.subtype === 'Renovação Primme') {
            target = data.renewal;
        } else if (item.type !== 'ENDORSEMENT') {
            target = data.new;
        } else {
            target = null;
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
  }, [reportItems]);

  // Averages Helpers
  const getAvg = (val: number, count: number) => count > 0 ? val / count : 0;

  // Formatter for Display
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNumber = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Excel Export Handler using XML Spreadsheet 2003 format to correctly support multiple sheets
  const handleExport = () => {
    // Helper to format values for XML
    const fmtStr = (val: any) => val ? String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const fmtNum = (val: number) => val || 0;
    const fmtDate = (d?: string) => {
        if (!d) return '';
        if (d.includes('-')) {
             // XML Spreadsheet expects YYYY-MM-DDT00:00:00.000
             return `${d}T00:00:00.000`;
        }
        return '';
    };

    // Calculate Collab Data beforehand
    const collaboratorGroups: {[key: string]: any[]} = {};
    reportItems.forEach(item => {
        const name = item.collaborator || 'Outros';
        if(!collaboratorGroups[name]) collaboratorGroups[name] = [];
        collaboratorGroups[name].push(item);
    });

    let workbookXML = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sSubHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="sDataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sCurrency">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sPercent">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.00%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sDate">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <NumberFormat ss:Format="Short Date"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sHighlight">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/>
   </Borders>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sSummaryBox">
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
    <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="sSummaryBoxCurrency">
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
    <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00"/>
    <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="sSummaryBoxPercent">
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
    <NumberFormat ss:Format="0.00%"/>
    <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;

    // --- SHEET 1: Produção Geral ---
    workbookXML += `<Worksheet ss:Name="Produção ${filterDate}">
  <Table ss:DefaultColumnWidth="100">
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="60"/>
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   
   <Row ss:Height="25">
    <Cell ss:MergeAcross="11" ss:StyleID="sTitle"><Data ss:Type="String">RELATÓRIO DE PRODUÇÃO - ${filterDate}</Data></Cell>
   </Row>
   <Row><Cell></Cell></Row>
   
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="sSubHeader"><Data ss:Type="String">RESUMO GERAL</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">PRÊMIO LÍQ. TOTAL</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.general.premium)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">COMISSÃO TOTAL</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.general.commission)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">ITENS PRODUZIDOS</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="Number">${fmtNum(metrics.general.count)}</Data></Cell>
   </Row>
   <Row><Cell></Cell></Row>
   
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="sSubHeader"><Data ss:Type="String">SEGURO NOVO</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">PRÊMIO LÍQUIDO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.new.premium)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">COMISSÃO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.new.commission)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">TICKET MÉDIO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(getAvg(metrics.new.premium, metrics.new.count))}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">MÉDIA COMISSÃO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxPercent"><Data ss:Type="Number">${fmtNum(getAvg(metrics.new.commPctSum, metrics.new.count)/100)}</Data></Cell>
   </Row>
   <Row><Cell></Cell></Row>

   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="sSubHeader"><Data ss:Type="String">RENOVAÇÕES PRIMME</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">PRÊMIO LÍQUIDO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.renewal.premium)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">COMISSÃO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(metrics.renewal.commission)}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">TICKET MÉDIO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(getAvg(metrics.renewal.premium, metrics.renewal.count))}</Data></Cell>
    <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">MÉDIA COMISSÃO</Data></Cell>
    <Cell ss:StyleID="sSummaryBoxPercent"><Data ss:Type="Number">${fmtNum(getAvg(metrics.renewal.commPctSum, metrics.renewal.count)/100)}</Data></Cell>
   </Row>
   <Row><Cell></Cell></Row>

   <Row>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">ID</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Vigência Início</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Segurado</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Seguradora</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Prêmio Líquido</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">% Com</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Comissão Base</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Forma Pagto</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Parc</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Comissão Final (85%)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Colaborador</Data></Cell>
   </Row>`;

   reportItems.forEach(item => {
        const { baseValue, finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
        let payMethodShort = item.paymentMethod || '-';
        if (payMethodShort.toUpperCase().includes('PORTO')) payMethodShort = 'CP';
        else if (payMethodShort.toUpperCase().includes('CRÉDITO')) payMethodShort = 'CC';

        workbookXML += `<Row>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.id)}</Data></Cell>
            <Cell ss:StyleID="sDate"><Data ss:Type="DateTime">${fmtDate(item.startDate)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.subtype)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.leadName)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.insurer)}</Data></Cell>
            <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${fmtNum(item.netPremium)}</Data></Cell>
            <Cell ss:StyleID="sPercent"><Data ss:Type="Number">${fmtNum(item.commissionPct/100)}</Data></Cell>
            <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${fmtNum(baseValue)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(payMethodShort)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.installments)}</Data></Cell>
            <Cell ss:StyleID="sHighlight"><Data ss:Type="Number">${fmtNum(finalValue)}</Data></Cell>
            <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.collaborator)}</Data></Cell>
        </Row>`;
   });

   workbookXML += `</Table></Worksheet>`;

   // --- SHEETS FOR COLLABORATORS ---
   Object.keys(collaboratorGroups).forEach(collabName => {
        const items = collaboratorGroups[collabName];
        let totalPremium = 0;
        let totalCommission = 0;
        items.forEach(i => {
             const { finalValue } = calculateFinalCommission(i.netPremium, i.commissionPct, i.paymentMethod, i.installments);
             totalPremium += i.netPremium || 0;
             totalCommission += finalValue;
        });

        // Clean Sheet Name (max 31 chars, no invalid chars)
        let sheetName = `${collabName.split(' ')[0]} ${filterDate}`;
        sheetName = sheetName.replace(/[\[\]\*\?\/\\\:]/g, ''); 

        workbookXML += `<Worksheet ss:Name="${sheetName}">
            <Table ss:DefaultColumnWidth="100">
            <Column ss:Width="150"/>
            <Column ss:Width="80"/>
            <Column ss:Width="100"/>
            <Column ss:Width="200"/>
            <Column ss:Width="100"/>
            <Column ss:Width="100"/>
            <Column ss:Width="80"/>
            <Column ss:Width="100"/>
            <Column ss:Width="100"/>
            <Column ss:Width="60"/>
            <Column ss:Width="120"/>
            <Column ss:Width="150"/>

            <Row ss:Height="25">
                <Cell ss:MergeAcross="11" ss:StyleID="sTitle"><Data ss:Type="String">PRODUÇÃO INDIVIDUAL - ${collabName.toUpperCase()}</Data></Cell>
            </Row>
            <Row><Cell></Cell></Row>
            
            <Row>
                <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">TOTAL PRÊMIO</Data></Cell>
                <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(totalPremium)}</Data></Cell>
                <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">TOTAL COMISSÃO</Data></Cell>
                <Cell ss:StyleID="sSummaryBoxCurrency"><Data ss:Type="Number">${fmtNum(totalCommission)}</Data></Cell>
                <Cell ss:StyleID="sSummaryBox"><Data ss:Type="String">ITENS</Data></Cell>
                <Cell ss:StyleID="sSummaryBox"><Data ss:Type="Number">${items.length}</Data></Cell>
            </Row>
            <Row><Cell></Cell></Row>

            <Row>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">ID</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Vigência Início</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tipo</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Segurado</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Seguradora</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Prêmio Líquido</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">% Com</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Comissão Base</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Forma Pagto</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Parc</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Comissão Final (85%)</Data></Cell>
                <Cell ss:StyleID="sHeader"><Data ss:Type="String">Colaborador</Data></Cell>
            </Row>`;
        
        items.forEach(item => {
             const { baseValue, finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
             let payMethodShort = item.paymentMethod || '-';
             if (payMethodShort.toUpperCase().includes('PORTO')) payMethodShort = 'CP';
             else if (payMethodShort.toUpperCase().includes('CRÉDITO')) payMethodShort = 'CC';

             workbookXML += `<Row>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.id)}</Data></Cell>
                <Cell ss:StyleID="sDate"><Data ss:Type="DateTime">${fmtDate(item.startDate)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.subtype)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.leadName)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.insurer)}</Data></Cell>
                <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${fmtNum(item.netPremium)}</Data></Cell>
                <Cell ss:StyleID="sPercent"><Data ss:Type="Number">${fmtNum(item.commissionPct/100)}</Data></Cell>
                <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${fmtNum(baseValue)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(payMethodShort)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.installments)}</Data></Cell>
                <Cell ss:StyleID="sHighlight"><Data ss:Type="Number">${fmtNum(finalValue)}</Data></Cell>
                <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${fmtStr(item.collaborator)}</Data></Cell>
             </Row>`;
        });

        workbookXML += `</Table></Worksheet>`;
   });

   workbookXML += `</Workbook>`;

   const blob = new Blob([workbookXML], { type: 'application/vnd.ms-excel' });
   const url = URL.createObjectURL(blob);
   const link = document.createElement("a");
   link.href = url;
   link.download = `Relatorio_Producao_${filterDate}.xls`;
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
       {/* HEADER */}
       <div className="mb-4 flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <FileBarChart2 className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-800">Relatórios de Produção</h2>
                <p className="text-xs text-gray-500">Financeiro, Comissões (85%) e Performance</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5">
                 <Calendar className="w-4 h-4 text-gray-500" />
                 <input 
                    type="month" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-sm font-medium text-gray-700 outline-none bg-transparent cursor-pointer"
                 />
             </div>

             <button 
                onClick={handleExport}
                disabled={reportItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 text-sm"
            >
                <FileText className="w-4 h-4" />
                Baixar Excel
            </button>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto pr-2 space-y-6">
           
           {/* 1. RESUMO GERAL */}
           <section>
               <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                   <Shield className="w-4 h-4" /> Resumo Geral (Novo + Renovação + Endossos)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 rounded-xl shadow-lg text-white">
                       <p className="text-xs font-medium text-indigo-100 uppercase">Prêmio Líquido Total</p>
                       <p className="text-2xl font-bold mt-1">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.general.premium)}
                       </p>
                       <div className="mt-2 text-xs text-indigo-200 flex items-center gap-1">
                           <DollarSign className="w-3 h-3" /> Soma Geral
                       </div>
                   </div>
                   <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 rounded-xl shadow-lg text-white">
                       <p className="text-xs font-medium text-emerald-100 uppercase">Comissão Total (Final 85%)</p>
                       <p className="text-2xl font-bold mt-1">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.general.commission)}
                       </p>
                       <div className="mt-2 text-xs text-emerald-200 flex items-center gap-1">
                           <DollarSign className="w-3 h-3" /> Receita Prevista
                       </div>
                   </div>
                   <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
                       <p className="text-xs font-bold text-gray-400 uppercase">Itens Produzidos</p>
                       <p className="text-3xl font-extrabold text-gray-800 mt-1">{metrics.general.count}</p>
                       <p className="text-[10px] text-gray-400">Vendas (Novo + Renovação)</p>
                   </div>
               </div>
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               
               {/* 2. SEGURO NOVO */}
               <section className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                   <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                       <Plus className="w-4 h-4" /> Seguro Novo (Inclui Renovações Mercado)
                   </h3>
                   <div className="grid grid-cols-2 gap-3 mb-4">
                       <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Prêmio Líquido</p>
                           <p className="text-lg font-bold text-gray-800">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.new.premium)}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Comissão (85%)</p>
                           <p className="text-lg font-bold text-green-700">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.new.commission)}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Ticket Médio</p>
                           <p className="text-base font-bold text-gray-800">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getAvg(metrics.new.premium, metrics.new.count))}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Média Comissão</p>
                           <p className="text-base font-bold text-gray-800">
                               {getAvg(metrics.new.commPctSum, metrics.new.count).toFixed(2)}%
                           </p>
                       </div>
                   </div>
                   
                   {/* Insurers Breakdown */}
                   <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-1.5 bg-white rounded border border-blue-200">
                            <span className="text-[9px] font-bold text-blue-600 block">PORTO</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.new.insurers.porto}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-cyan-200">
                            <span className="text-[9px] font-bold text-cyan-600 block">AZUL</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.new.insurers.azul}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-orange-200">
                            <span className="text-[9px] font-bold text-orange-600 block">ITAÚ</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.new.insurers.itau}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-gray-200">
                            <span className="text-[9px] font-bold text-gray-400 block">OUTRAS</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.new.insurers.others}</span>
                        </div>
                   </div>
               </section>

               {/* 3. RENOVAÇÕES */}
               <section className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                   <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                       <RefreshCw className="w-4 h-4" /> Renovações Primme
                   </h3>
                   <div className="grid grid-cols-2 gap-3 mb-4">
                       <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Prêmio Líquido</p>
                           <p className="text-lg font-bold text-gray-800">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.renewal.premium)}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Comissão (85%)</p>
                           <p className="text-lg font-bold text-green-700">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.renewal.commission)}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Ticket Médio</p>
                           <p className="text-base font-bold text-gray-800">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getAvg(metrics.renewal.premium, metrics.renewal.count))}
                           </p>
                       </div>
                       <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Média Comissão</p>
                           <p className="text-base font-bold text-gray-800">
                               {getAvg(metrics.renewal.commPctSum, metrics.renewal.count).toFixed(2)}%
                           </p>
                       </div>
                   </div>

                    {/* Insurers Breakdown */}
                   <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-1.5 bg-white rounded border border-blue-200">
                            <span className="text-[9px] font-bold text-blue-600 block">PORTO</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.renewal.insurers.porto}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-cyan-200">
                            <span className="text-[9px] font-bold text-cyan-600 block">AZUL</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.renewal.insurers.azul}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-orange-200">
                            <span className="text-[9px] font-bold text-orange-600 block">ITAÚ</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.renewal.insurers.itau}</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-gray-200">
                            <span className="text-[9px] font-bold text-gray-400 block">OUTRAS</span>
                            <span className="text-sm font-extrabold text-gray-800">{metrics.renewal.insurers.others}</span>
                        </div>
                   </div>
               </section>
           </div>
       </div>
    </div>
  );
};
