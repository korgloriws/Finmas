
import requests
import re
import time
from typing import Optional, Dict

def extrair_portfolio_fundsexplorer(html: str, ticker: str) -> Optional[Dict]:

    try:
        portfolio = {
            'imoveis': [],
            'titulos': [],
            'estados_distribuicao': {},
            'tipos_imoveis': [],
            'total_area': 0
        }
        

        nome_imovel_pattern = r'<div class="locationGrid__title">([^<]+)</div>'
        nomes_imoveis = re.findall(nome_imovel_pattern, html)
        

        nomes_imoveis = [nome.strip() for nome in nomes_imoveis if nome.strip()]
        
        

        endereco_pattern = r'</b>([^<]+)</li>'
        enderecos = re.findall(endereco_pattern, html)
        

        cidade_estado_pattern = r'</b>([^<]+)\s*-\s*([A-Z]{2})</li>'
        cidades_estados = re.findall(cidade_estado_pattern, html)
        

        if enderecos and cidades_estados:
            for i, endereco in enumerate(enderecos):
                if i < len(cidades_estados):
                    cidade, estado = cidades_estados[i]
                    

                    nome_imovel = f'Imóvel {i+1}'
                    if i < len(nomes_imoveis):
                        nome_imovel = nomes_imoveis[i]
                    
                    imovel = {
                        'nome': nome_imovel,
                        'endereco': endereco.strip(),
                        'cidade': cidade.strip(),
                        'estado': estado.strip(),
                        'area': 0, 
                        'tipo': determinar_tipo_imovel_scraping(endereco, cidade)
                    }
                    portfolio['imoveis'].append(imovel)
        
     
        if portfolio['imoveis']:
            estados = {}
            for imovel in portfolio['imoveis']:
                estado = imovel['estado']
                if estado:
                    if estado not in estados:
                        estados[estado] = 0
                    estados[estado] += 1
            
           
            total = len(portfolio['imoveis'])
            for estado in estados:
                portfolio['estados_distribuicao'][estado] = (estados[estado] / total) * 100
        
        # Extrair tipos de imóveis
        if portfolio['imoveis']:
            tipos = list(set([imovel['tipo'] for imovel in portfolio['imoveis'] if imovel['tipo']]))
            portfolio['tipos_imoveis'] = tipos
        
        # Verificar se encontrou informações relevantes
        if portfolio['imoveis'] or portfolio['estados_distribuicao']:
            return portfolio
        
        return None
        
    except Exception as e:
        print(f"[ERRO] Extração de portfólio: {e}")
        return None


def determinar_tipo_imovel_scraping(endereco: str, cidade: str) -> str:

    endereco_lower = endereco.lower()
    cidade_lower = cidade.lower()
    

    if 'estrada' in endereco_lower or 'rodovia' in endereco_lower:
        return 'Logística'
    elif 'avenida' in endereco_lower:
        if 'shopping' in cidade_lower or 'center' in cidade_lower:
            return 'Shopping'
        else:
            return 'Comercial'
    elif 'rua' in endereco_lower:
        return 'Comercial'
    else:
        return 'Comercial'


def obter_dados_fii_fundsexplorer(ticker: str) -> Optional[Dict]:

    ticker_limpo = ticker.replace('.SA', '').replace('.sa', '').upper()
    
    url = f'https://www.fundsexplorer.com.br/funds/{ticker_limpo}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    }
    
    try:
        print(f"[FundsExplorer] Buscando {ticker_limpo}...")
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            print(f"[ERRO] Status {response.status_code}")
            return None
        
        html = response.text
        
        # Verificar se existe
        if 'não encontrado' in html.lower() or len(html) < 5000:
            print(f"[ERRO] FII não encontrado")
            return None
        
        resultado = {
            'ticker': ticker_limpo,
            'fonte': 'FundsExplorer'
        }
        
     
        tipo_match = re.search(r'do\s+tipo\s+([a-záàâãéèêíïóôõöúçñ\s]+)', html, re.I)
        tipo_text = None
        if tipo_match:
            tipo_text = tipo_match.group(1).strip()
          
            tipo_text = tipo_text.split('.')[0].split(',')[0].split('\n')[0].strip()
            
            if tipo_text and len(tipo_text) < 100:
                tipo_lower = tipo_text.lower()
                

                if 'papel' in tipo_lower or 'fof' in tipo_lower or 'receb' in tipo_lower or 'cri' in tipo_lower:
                    resultado['tipo'] = 'Papel'
                elif 'híbrido' in tipo_lower or 'hibrido' in tipo_lower or 'misto' in tipo_lower:
                    resultado['tipo'] = 'Híbrido'
                elif 'tijolo' in tipo_lower:
                    resultado['tipo'] = 'Tijolo'
                else:
                    
                    resultado['tipo'] = 'Tijolo'
        

        segmento_patterns = [
            r'do\s+segmento\s+de\s+([a-záàâãéèêíïóôõöúçñ\s]+)',
            r'de\s+segmento\s+([a-záàâãéèêíïóôõöúçñ\s]+)',
            r'do\s+segmento\s+([a-záàâãéèêíïóôõöúçñ\s]+)',
        ]
        
        segmento_text = None
        for pattern in segmento_patterns:
            match = re.search(pattern, html, re.I)
            if match:
                segmento_text = match.group(1).strip()
              
                segmento_text = segmento_text.split('.')[0].split(',')[0].split('\n')[0].strip()
                

                if segmento_text and len(segmento_text) < 50:
   
                    segmento_text = segmento_text.capitalize()
                    resultado['segmento'] = segmento_text
                    break
        
        # Se não achou tipo ainda, tentar extrair do segmento
        if 'tipo' not in resultado and segmento_text:
            seg_lower = segmento_text.lower()
            if 'híbrido' in seg_lower or 'hibrido' in seg_lower:
                resultado['tipo'] = 'Híbrido'
            elif 'papel' in seg_lower or 'titulo' in seg_lower or 'crédito' in seg_lower:
                resultado['tipo'] = 'Papel'
            else:
                resultado['tipo'] = 'Tijolo'
        
        # Tentar extrair gestora
        gestora_patterns = [
            r'gestora[:\s]+([a-zA-Z\s&]+)',
            r'gestão:\s*([a-zA-Z\s&]+)',
        ]
        
        for pattern in gestora_patterns:
            match = re.search(pattern, html, re.I)
            if match:
                gestora = match.group(1).strip()
                if len(gestora) < 50:
                    resultado['gestora'] = gestora
                    break
        
        # Extrair PORTFÓLIO
        portfolio = extrair_portfolio_fundsexplorer(html, ticker_limpo)
        if portfolio:
            resultado['portfolio'] = portfolio
            print(f"[PORTFÓLIO] Encontrado: {len(portfolio.get('imoveis', []))} imóveis, {len(portfolio.get('titulos', []))} títulos")
        

        if 'tipo' in resultado or 'segmento' in resultado:
            print(f"[SUCESSO] {resultado}")
            return resultado
        else:
            print(f"[ERRO] Não encontrou tipo/segmento")
            return None
            
    except Exception as e:
        print(f"[ERRO] Exception: {e}")
        return None


def obter_metadata_fii(ticker: str) -> Optional[Dict]:

    return obter_dados_fii_fundsexplorer(ticker)


# Teste
if __name__ == '__main__':
    print("\n=== TESTE DE SCRAPING DE FIIs (V2) ===\n")
    
    tickers = ['HGLG11', 'MXRF11', 'VISC11', 'KNRI11', 'XPML11',"XPCI11"]
    
    for ticker in tickers:
        print(f"\n--- {ticker} ---")
        dados = obter_metadata_fii(ticker)
        if dados:
            print(f"[OK] Tipo: {dados.get('tipo')}, Segmento: {dados.get('segmento')}")
        else:
            print(f"[FAIL]")
        print("-" * 50)
        time.sleep(1)

