"""
Scraper para buscar agenda de dividendos do investidor10.com.br
"""

import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

def extrair_dividendos_tabela(tabela, tipo_ativo: str) -> List[Dict[str, Any]]:
    """Extrai dados de dividendos de uma tabela HTML do investidor10"""
    dividendos = []
    
    linhas = tabela.find_all('tr')
    if len(linhas) < 2:  # Precisa ter pelo menos cabeçalho + 1 linha
        return dividendos
    
    # Pular cabeçalho
    for linha in linhas[1:]:
        try:
            celulas = linha.find_all('td')
            if len(celulas) < 5:
                continue
            
            # Coluna 1: Empresa (ticker e nome)
            primeira_celula = celulas[0]
            link = primeira_celula.find('a')
            if not link:
                continue
            
            ticker_elem = link.find('div', class_='ticker-name')
            nome_elem = link.find('div', class_='company-name')
            
            ticker = ticker_elem.get_text(strip=True).upper() if ticker_elem else ''
            nome = nome_elem.get_text(strip=True) if nome_elem else ''
            
            if not ticker:
                continue
            
            # Coluna 2: Data Com
            data_com_elem = celulas[1].find('span', class_='table-field')
            data_com_texto = data_com_elem.get_text(strip=True) if data_com_elem else ''
            if not data_com_texto:
                continue
            
            # Coluna 3: Data Pagamento
            data_pgto_elem = celulas[2].find('span', class_='table-field')
            data_pgto_texto = data_pgto_elem.get_text(strip=True) if data_pgto_elem else ''
            
            # Coluna 4: Tipo
            tipo_elem = celulas[3].find('span', class_='table-field')
            tipo = tipo_elem.get_text(strip=True) if tipo_elem else ''
            
            # Coluna 5: Valor
            valor_elem = celulas[4].find('span', class_='payment-price')
            if not valor_elem:
                # Tentar encontrar em outro lugar
                valor_elem = celulas[4].find('span')
            valor_texto = valor_elem.get_text(strip=True) if valor_elem else ''
            
            # Limpar e converter valor
            valor_limpo = valor_texto.replace('R$', '').replace(' ', '').replace(',', '.')
            try:
                valor = float(valor_limpo)
            except:
                valor = 0.0
            
            # Converter datas (formato: DD/MM/YY)
            data_com_dt = None
            data_pgto_dt = None
            
            try:
                # Tentar formato DD/MM/YY
                data_com_dt = datetime.strptime(data_com_texto, '%d/%m/%y')
            except ValueError:
                try:
                    # Tentar formato DD/MM/YYYY
                    data_com_dt = datetime.strptime(data_com_texto, '%d/%m/%Y')
                except ValueError:
                    continue
            
            try:
                data_pgto_dt = datetime.strptime(data_pgto_texto, '%d/%m/%y')
            except ValueError:
                try:
                    data_pgto_dt = datetime.strptime(data_pgto_texto, '%d/%m/%Y')
                except ValueError:
                    # Se não conseguir parsear data de pagamento, usar data_com + 30 dias como fallback
                    if data_com_dt:
                        from datetime import timedelta
                        data_pgto_dt = data_com_dt + timedelta(days=30)
                    else:
                        continue
            
            # Determinar tipo de ativo baseado no ticker
            # tipo_ativo do parâmetro pode ser 'acoes', 'fiis', 'bdrs' - vamos mapear
            if tipo_ativo:
                tipo_map = {
                    'acoes': 'Acao',
                    'fiis': 'FII',
                    'bdrs': 'BDR'
                }
                tipo_ativo_final = tipo_map.get(tipo_ativo, 'Acao')
            elif ticker.endswith('11'):
                tipo_ativo_final = 'FII'
            elif any(bdr in ticker for bdr in ['34', '35', '36', '39']):
                tipo_ativo_final = 'BDR'
            else:
                tipo_ativo_final = 'Acao'
            
            dividendo = {
                'ticker': ticker,
                'nome': nome,
                'tipo_ativo': tipo_ativo_final,
                'tipo_provento': tipo,
                'data_com': data_com_dt.strftime('%Y-%m-%d'),
                'data_pagamento': data_pgto_dt.strftime('%Y-%m-%d'),
                'valor': valor,
                'fonte': 'investidor10.com.br'
            }
            
            dividendos.append(dividendo)
            
        except Exception as e:
            # Pular linhas com erro
            continue
    
    return dividendos

def buscar_agenda_dividendos(mes: Optional[int] = None, ano: Optional[int] = None, tipo_ativo: Optional[str] = None) -> Dict[str, Any]:
    """
    Busca agenda de dividendos do investidor10.com.br
    
    Args:
        mes: mês (1-12), padrão: mês atual
        ano: ano (ex: 2025), padrão: ano atual
        tipo_ativo: 'acoes', 'fiis' ou 'bdrs', padrão: todos
    """
    
    if mes is None:
        mes = datetime.now().month
    if ano is None:
        ano = datetime.now().year
    
    # URLs base do investidor10
    urls_base = {
        'acoes': 'https://investidor10.com.br/acoes/dividendos/',
        'fiis': 'https://investidor10.com.br/fiis/dividendos/',
        'bdrs': 'https://investidor10.com.br/bdrs/dividendos/'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://investidor10.com.br/'
    }
    
    try:
        # Se tipo_ativo não especificado, buscar todos
        tipos_para_buscar = []
        if tipo_ativo:
            tipos_para_buscar = [tipo_ativo]
        else:
            tipos_para_buscar = ['acoes', 'fiis', 'bdrs']
        
        todos_dividendos = []
        print(f"[INFO] Buscando dividendos para mes={mes}, ano={ano}, tipos={tipos_para_buscar}")
        
        # Buscar para cada tipo de ativo
        for tipo in tipos_para_buscar:
            print(f"[INFO] Processando tipo: {tipo}")
            url = urls_base.get(tipo)
            if not url:
                continue
            
            try:
                response = requests.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                
                # Parsear HTML
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Encontrar todas as tabelas
                tabelas = soup.find_all('table')
                
                # Extrair dados de cada tabela
                for tabela in tabelas:
                    try:
                        dividendos = extrair_dividendos_tabela(tabela, tipo)
                        todos_dividendos.extend(dividendos)
                    except Exception as e:
                        print(f"[AVISO] Erro ao extrair dados da tabela para {tipo}: {e}")
                        continue
                    
            except Exception as e:
                print(f"[ERRO] Erro ao buscar tipo {tipo} para mes {mes}/{ano}: {e}")
                continue
        
        # Filtrar por data-com (garantir que está no mês/ano selecionado)
        dividendos_filtrados = []
        print(f"[INFO] Total de dividendos extraidos antes do filtro: {len(todos_dividendos)}")
        for d in todos_dividendos:
            try:
                if not d.get('data_com'):
                    continue
                data_com_dt = datetime.strptime(d['data_com'], '%Y-%m-%d')
                # Filtrar por mês e ano
                if data_com_dt.month == mes and data_com_dt.year == ano:
                    dividendos_filtrados.append(d)
            except Exception as e:
                # Se não conseguir parsear a data, pular o item
                print(f"[AVISO] Erro ao parsear data: {d.get('data_com', 'N/A')} - {e}")
                continue
        
        print(f"[INFO] Total de dividendos apos filtro mes/ano: {len(dividendos_filtrados)}")
        
        # Separar por tipo de ativo
        acoes = [d for d in dividendos_filtrados if d.get('tipo_ativo') == 'Acao']
        fiis = [d for d in dividendos_filtrados if d.get('tipo_ativo') == 'FII']
        bdrs = [d for d in dividendos_filtrados if d.get('tipo_ativo') == 'BDR']
        
        print(f"[INFO] Separacao por tipo: Acoes={len(acoes)}, FIIs={len(fiis)}, BDRs={len(bdrs)}")
        
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
        print(f"[ERRO] Erro ao buscar agenda de dividendos: {e}")
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
    print("Testando scraper de agenda de dividendos (investidor10)...")
    resultado = buscar_agenda_dividendos(mes=11, ano=2025)
    print(f"\nResultado:")
    print(f"  Mes: {resultado['mes']}, Ano: {resultado['ano']}")
    print(f"  Acoes: {resultado['acoes']['total']} itens")
    print(f"  FIIs: {resultado['fiis']['total']} itens")
    print(f"  BDRs: {resultado['bdrs']['total']} itens")
    
    if resultado['acoes']['dividendos']:
        print(f"\nExemplo de acao:")
        print(f"  {resultado['acoes']['dividendos'][0]}")

