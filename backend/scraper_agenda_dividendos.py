"""
Scraper para buscar agenda de dividendos do agendadividendos.com
"""

import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import time

def extrair_dividendos_tabela(tabela) -> List[Dict[str, Any]]:
    """Extrai dados de dividendos de uma tabela HTML"""
    dividendos = []
    
    linhas = tabela.find_all('tr')
    if len(linhas) < 2:  # Precisa ter pelo menos cabeçalho + 1 linha
        return dividendos
    
    # Pular cabeçalho
    for linha in linhas[1:]:
        celulas = linha.find_all(['td', 'th'])
        if len(celulas) >= 5:  # Esperamos pelo menos 5 colunas
            try:
                # Primeira célula: Ativo (tem link com ticker e span com nome)
                primeira_celula = celulas[0]
                link = primeira_celula.find('a')
                span_nome = primeira_celula.find('span', class_=re.compile(r'text-muted|text-0_75x'))
                
                if not link:
                    continue
                
                ticker = link.get_text(strip=True).upper()
                nome = span_nome.get_text(strip=True) if span_nome else ''
                
                # Outras células
                data_com = celulas[1].get_text(strip=True)
                data_pgto = celulas[2].get_text(strip=True)
                tipo = celulas[3].get_text(strip=True)
                
                # Valor: usar atributo title se disponível (mais preciso), senão usar texto
                valor_celula = celulas[4]
                valor_title = valor_celula.get('title')
                valor_texto = valor_celula.get_text(strip=True)
                
                if valor_title:
                    valor = float(valor_title.replace(',', '.'))
                else:
                    valor = float(valor_texto.replace(',', '.').replace('R$', '').strip())
                
                # Determinar tipo de ativo baseado no ticker
                if ticker.endswith('11'):
                    tipo_ativo = 'FII'
                elif any(bdr in ticker for bdr in ['34', '35', '36']):
                    tipo_ativo = 'BDR'
                else:
                    tipo_ativo = 'Acao'  # Sem acento para evitar problemas de encoding
                
                # Converter datas (formato: DD/MM/YY)
                try:
                    data_com_dt = datetime.strptime(data_com, '%d/%m/%y')
                    data_pgto_dt = datetime.strptime(data_pgto, '%d/%m/%y')
                except ValueError:
                    # Tentar formato alternativo
                    try:
                        data_com_dt = datetime.strptime(data_com, '%d/%m/%Y')
                        data_pgto_dt = datetime.strptime(data_pgto, '%d/%m/%Y')
                    except ValueError:
                        continue
                
                dividendo = {
                    'ticker': ticker,
                    'nome': nome,
                    'tipo_ativo': tipo_ativo,
                    'tipo_provento': tipo,  # DIVIDENDO, JCP, etc
                    'data_com': data_com_dt.strftime('%Y-%m-%d'),
                    'data_pagamento': data_pgto_dt.strftime('%Y-%m-%d'),
                    'valor': valor,
                    'fonte': 'agendadividendos.com'
                }
                
                dividendos.append(dividendo)
                
            except Exception as e:
                # Pular linhas com erro
                continue
    
    return dividendos

def buscar_agenda_dividendos(mes: Optional[int] = None, ano: Optional[int] = None, tipo_ativo: Optional[str] = None) -> Dict[str, Any]:

    if mes is None:
        mes = datetime.now().month
    if ano is None:
        ano = datetime.now().year
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://agendadividendos.com/calendario/',
    }
    
    try:
        # Mapear tipo de ativo para código do site
        # 1 = Ações, 2 = FIIs, 4 = BDRs
        tipo_map = {
            'acoes': '1',
            'fiis': '2',
            'bdrs': '4'
        }
        
        # Se tipo_ativo não especificado, buscar todos
        tipos_para_buscar = []
        if tipo_ativo:
            tipos_para_buscar = [tipo_map.get(tipo_ativo)]
        else:
            tipos_para_buscar = ['1', '2', '4']  # Ações, FIIs, BDRs
        
        todos_dividendos = []
        
        # Buscar para cada tipo de ativo
        for tipo_codigo in tipos_para_buscar:
            # API AJAX do site: agenda.php?a=get-mes&tipo=X&ano=Y&mes=Z&tipoData=2
            # tipoData: 1=Pagamentos, 2=Data-com (vamos usar 2 para data-com)
            url_api = f"https://agendadividendos.com/app/ajax/agenda.php?a=get-mes&tipo={tipo_codigo}&ano={ano}&mes={mes}&tipoData=2"
            
            try:
                response = requests.get(url_api, headers=headers, timeout=15)
                response.raise_for_status()
                
                # A resposta é HTML com tabelas
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Encontrar todas as tabelas na resposta
                tabelas = soup.find_all('table')
                
                # Extrair dados de cada tabela
                for tabela in tabelas:
                    dividendos = extrair_dividendos_tabela(tabela)
                    todos_dividendos.extend(dividendos)
                    
            except Exception as e:
                print(f"Erro ao buscar tipo {tipo_codigo} para mes {mes}/{ano}: {e}")
                continue
        
        # Filtrar por data-com (garantir que está no mês/ano selecionado)
        # A API pode retornar dados próximos, então vamos filtrar novamente
        dividendos_filtrados = []
        for d in todos_dividendos:
            try:
                data_com_dt = datetime.strptime(d['data_com'], '%Y-%m-%d')
                if data_com_dt.month == mes and data_com_dt.year == ano:
                    dividendos_filtrados.append(d)
            except:
                # Se não conseguir parsear a data, manter o item (pode ser útil)
                dividendos_filtrados.append(d)
        
        # Separar por tipo de ativo
        acoes = [d for d in dividendos_filtrados if d['tipo_ativo'] == 'Acao']
        fiis = [d for d in dividendos_filtrados if d['tipo_ativo'] == 'FII']
        bdrs = [d for d in dividendos_filtrados if d['tipo_ativo'] == 'BDR']
        
        # Ordenar por data-com (data de corte)
        acoes.sort(key=lambda x: x['data_com'])
        fiis.sort(key=lambda x: x['data_com'])
        bdrs.sort(key=lambda x: x['data_com'])
        
        return {
            'mes': mes,
            'ano': ano,
            'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'acoes': {
                'total': len(acoes),
                'dividendos': acoes,
                'total_estimado': sum(d['valor'] for d in acoes)
            },
            'fiis': {
                'total': len(fiis),
                'dividendos': fiis,
                'total_estimado': sum(d['valor'] for d in fiis)
            },
            'bdrs': {
                'total': len(bdrs),
                'dividendos': bdrs,
                'total_estimado': sum(d['valor'] for d in bdrs)
            }
        }
        
    except Exception as e:
        print(f"Erro ao buscar agenda de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return {
            'mes': mes or datetime.now().month,
            'ano': ano or datetime.now().year,
            'data_busca': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'erro': str(e),
            'acoes': {'total': 0, 'dividendos': [], 'total_estimado': 0},
            'fiis': {'total': 0, 'dividendos': [], 'total_estimado': 0},
            'bdrs': {'total': 0, 'dividendos': [], 'total_estimado': 0}
        }

if __name__ == "__main__":
    # Teste
    print("Testando scraper de agenda de dividendos...")
    resultado = buscar_agenda_dividendos(mes=11, ano=2025)
    print(f"\nResultado:")
    print(f"  Mes: {resultado['mes']}, Ano: {resultado['ano']}")
    print(f"  Acoes: {resultado['acoes']['total']} itens")
    print(f"  FIIs: {resultado['fiis']['total']} itens")
    print(f"  BDRs: {resultado['bdrs']['total']} itens")
    
    if resultado['acoes']['dividendos']:
        print(f"\nExemplo de acao:")
        print(f"  {resultado['acoes']['dividendos'][0]}")

