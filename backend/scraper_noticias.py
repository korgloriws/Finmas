"""
Scraper de notícias do Dados de Mercado
URL: https://www.dadosdemercado.com.br/ultimas-noticias
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict, Optional
import time
import re

def obter_noticias(limite: int = 20) -> List[Dict]:
    """
    Obtém as últimas notícias do Dados de Mercado
    
    Args:
        limite: Número máximo de notícias a retornar (padrão: 20)
    
    Returns:
        Lista de dicionários com informações das notícias:
        {
            'titulo': str,
            'resumo': str,
            'url': str,
            'data': str (ISO format),
            'autor': str (opcional),
            'categoria': str (opcional),
            'imagem_url': str (opcional)
        }
    """
    try:
        url = "https://www.dadosdemercado.com.br/ultimas-noticias"
        
        # Headers para simular navegador
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Fazer requisição
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Parsear HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        noticias = []
        
        # Estratégia: Buscar elementos que contêm notícias completas
        # No dadosdemercado, cada notícia está em um bloco (div, p, li, etc) que contém:
        # - Link com título
        # - Data e hora
        # - Categoria
        # - Fonte
        
        # Buscar todos os elementos que podem conter notícias
        elementos_noticias = []
        
        # Tentar encontrar por padrão de texto (data + categoria + fonte)
        todos_elementos = soup.find_all(['div', 'p', 'li', 'article', 'section'])
        
        for elemento in todos_elementos:
            texto = elemento.get_text(separator=' ', strip=True)
            
            # Verificar se tem padrão de notícia: data + categoria + fonte
            tem_data = re.search(r'\d{1,2}\s+(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*,?\s+\d{4}\s+\d{1,2}:\d{2}', texto, re.IGNORECASE)
            tem_link_externo = elemento.find('a', href=re.compile(r'(valor\.globo|infomoney|enfoque|bloomberglinea)'))
            
            if tem_data and tem_link_externo:
                elementos_noticias.append(elemento)
        
        # Se não encontrou por padrão, buscar links diretamente
        if not elementos_noticias:
            links_noticias = soup.find_all('a', href=True)
            for link in links_noticias:
                href = link.get('href', '')
                texto = link.get_text(strip=True)
                
                if (href and 
                    href.startswith('http') and
                    len(texto) > 10 and
                    ('valor.globo.com' in href or
                     'infomoney.com.br' in href or
                     'enfoque.com.br' in href or
                     'bloomberglinea.com.br' in href)):
                    # Criar elemento virtual com o link e seu contexto
                    elemento_pai = link.parent
                    if elemento_pai:
                        elementos_noticias.append(elemento_pai)
        
        # Processar elementos encontrados
        for elemento in elementos_noticias[:limite]:
            try:
                # Encontrar link dentro do elemento
                link = elemento.find('a', href=True)
                if not link:
                    continue
                
                # Extrair título e URL do link
                titulo = link.get_text(strip=True)
                url_noticia = link.get('href', '')
                
                # Garantir URL absoluta
                if url_noticia and not url_noticia.startswith('http'):
                    if url_noticia.startswith('/'):
                        url_noticia = f"https://www.dadosdemercado.com.br{url_noticia}"
                    else:
                        url_noticia = f"https://www.dadosdemercado.com.br/{url_noticia}"
                
                if not titulo or not url_noticia or len(titulo) < 10:
                    continue
                
                # Pegar todo o texto do elemento (inclui título + metadados)
                texto_completo = elemento.get_text(separator=' ', strip=True)
                
                # Extrair data (formato: "23 Jan, 2026 08:35" ou "23 Jan 2026 08:35")
                data_str = None
                data_match = re.search(r'(\d{1,2}\s+(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*,?\s+\d{4}\s+\d{1,2}:\d{2})', texto_completo, re.IGNORECASE)
                if not data_match:
                    # Tentar sem vírgula
                    data_match = re.search(r'(\d{1,2}\s+(?:Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)[a-z]*\s+\d{4}\s+\d{1,2}:\d{2})', texto_completo, re.IGNORECASE)
                if data_match:
                    data_str = data_match.group(1)
                
                # Extrair categoria (texto entre a data e a fonte, após primeiro "·")
                categoria = None
                # Padrão: data · Categoria · Fonte
                categoria_match = re.search(r'\d{2}:\d{2}\s*·\s*([^·]+?)\s*·', texto_completo)
                if categoria_match:
                    categoria = categoria_match.group(1).strip()
                
                # Extrair fonte (último texto após último "·", mas antes de paginação)
                fonte = None
                # Buscar padrão: "· Fonte" (sem números de paginação depois)
                fonte_match = re.search(r'·\s*([A-Z][a-zA-Z\s]+?)(?:\s+\d+\s+\d+|$)', texto_completo)
                if fonte_match:
                    fonte = fonte_match.group(1).strip()
                    # Limpar fonte (remover espaços extras e caracteres especiais)
                    fonte = re.sub(r'\s+', ' ', fonte)
                    fonte = fonte.replace('**', '').strip()
                    # Remover palavras comuns de paginação
                    fonte = re.sub(r'\s*(Próxima|Anterior|1|2|3|4|5|6|7|8|9|10|\.\.\.).*$', '', fonte, flags=re.IGNORECASE)
                    fonte = fonte.strip()
                
                # Se não encontrou fonte válida no texto, extrair do domínio
                if not fonte or len(fonte) < 2 or fonte.isdigit() or 'Próxima' in fonte:
                    if 'valor.globo.com' in url_noticia:
                        fonte = 'Valor'
                    elif 'infomoney.com.br' in url_noticia:
                        fonte = 'Infomoney'
                    elif 'enfoque.com.br' in url_noticia:
                        fonte = 'Enfoque'
                    elif 'bloomberglinea.com.br' in url_noticia:
                        fonte = 'Bloomberg Línea'
                    elif 'agencia-brasil' in url_noticia or 'agenciabrasil' in url_noticia:
                        fonte = 'Agência Brasil'
                    elif 'bomdiademercado' in url_noticia:
                        fonte = 'Bom dia Mercado'
                    elif 'broadcast' in url_noticia:
                        fonte = 'Broadcast'
                    elif 'moneytimes' in url_noticia:
                        fonte = 'Money Times'
                
                # Converter data para ISO format
                data_iso = datetime.now().isoformat()
                if data_str:
                    try:
                        data_iso = _parsear_data_dadosdemercado(data_str)
                    except:
                        pass
                
                # Resumo vazio (será preenchido se necessário buscar detalhes)
                resumo = ''
                
                # Adicionar notícia
                noticias.append({
                    'titulo': titulo,
                    'resumo': resumo,
                    'url': url_noticia,
                    'data': data_iso,
                    'autor': None,
                    'categoria': categoria,
                    'fonte': fonte,
                    'imagem_url': None
                })
                    
            except Exception as e:
                print(f"[AVISO] Erro ao processar elemento: {e}")
                continue
        
        # Remover duplicatas (por URL)
        noticias_unicas = []
        urls_vistas = set()
        for noticia in noticias:
            if noticia['url'] not in urls_vistas:
                urls_vistas.add(noticia['url'])
                noticias_unicas.append(noticia)
        
        # Limitar quantidade
        return noticias_unicas[:limite]
        
    except requests.RequestException as e:
        print(f"[ERRO] Erro ao fazer requisição: {e}")
        return []
    except Exception as e:
        print(f"[ERRO] Erro ao processar notícias: {e}")
        import traceback
        traceback.print_exc()
        return []


def _parsear_data_dadosdemercado(data_str: str) -> str:
    """
    Parseia data no formato do dadosdemercado: "23 Jan, 2026 08:35"
    """
    data_str = data_str.strip()
    
    # Mapear meses em português/inglês
    meses_pt = {
        'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr',
        'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug',
        'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec'
    }
    
    # Normalizar formato: "23 Jan, 2026 08:35" ou "23 Jan 2026 08:35"
    data_str = re.sub(r',\s*', ' ', data_str)
    
    # Tentar formatos
    formatos = [
        '%d %b %Y %H:%M',  # "23 Jan 2026 08:35"
        '%d %B %Y %H:%M',  # "23 Janeiro 2026 08:35"
        '%d/%m/%Y %H:%M',
        '%d/%m/%Y',
    ]
    
    for formato in formatos:
        try:
            dt = datetime.strptime(data_str, formato)
            return dt.isoformat()
        except:
            continue
    
    # Se não conseguiu, retorna data atual
    return datetime.now().isoformat()


def obter_detalhes_noticia(url: str) -> Optional[Dict]:
    """
    Obtém detalhes completos de uma notícia específica
    
    Args:
        url: URL da notícia
    
    Returns:
        Dicionário com detalhes completos da notícia ou None se erro
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extrair conteúdo completo
        conteudo_elem = soup.find(['article', 'div'], class_=re.compile(r'conteudo|content|article-body|post-content', re.I))
        if not conteudo_elem:
            conteudo_elem = soup.find('main')
        if not conteudo_elem:
            conteudo_elem = soup.find('article')
        
        conteudo = ''
        if conteudo_elem:
            # Remover scripts e styles
            for script in conteudo_elem(['script', 'style']):
                script.decompose()
            conteudo = conteudo_elem.get_text(separator='\n', strip=True)
        
        return {
            'conteudo': conteudo,
            'url': url
        }
        
    except Exception as e:
        print(f"[ERRO] Erro ao obter detalhes da notícia {url}: {e}")
        return None
