from flask import Flask, jsonify, request, make_response, send_from_directory, send_file
from flask_cors import CORS
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import json
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    global_state, carregar_ativos, obter_carteira, adicionar_ativo_carteira, 
    remover_ativo_carteira, atualizar_ativo_carteira, obter_movimentacoes, obter_historico_carteira,

    salvar_receita, carregar_receitas_mes_ano, atualizar_receita, remover_receita,
    adicionar_cartao, atualizar_cartao, remover_cartao, 
    adicionar_outro_gasto, carregar_outros_mes_ano, atualizar_outro_gasto, remover_outro_gasto, 
    calcular_saldo_mes_ano,
    
    adicionar_cartao_cadastrado, listar_cartoes_cadastrados, atualizar_cartao_cadastrado, remover_cartao_cadastrado,
    adicionar_compra_cartao, listar_compras_cartao, atualizar_compra_cartao, remover_compra_cartao, calcular_total_compras_cartao,
    marcar_cartao_como_pago, desmarcar_cartao_como_pago, resetar_status_cartoes_novo_mes,

    consultar_marmitas, adicionar_marmita, atualizar_marmita, remover_marmita, gastos_mensais,

    criar_tabela_usuarios, cadastrar_usuario, buscar_usuario_por_username, verificar_senha,
    set_usuario_atual, get_usuario_atual, inicializar_bancos_usuario, criar_sessao, invalidar_sessao,

    verificar_resposta_seguranca, alterar_senha_direta, atualizar_pergunta_seguranca,
    invalidar_todas_sessoes,
    obter_historico_carteira_comparado,
    save_rebalance_config,
    get_rebalance_config,
    compute_rebalance_status,
    registrar_rebalance_event,
    get_rebalance_history,
    list_asset_types,
    create_asset_type,
    rename_asset_type,
    delete_asset_type,
    atualizar_precos_indicadores_carteira,
    obter_taxas_indexadores,
    _upgrade_controle_schema,
    LISTA_ACOES,
    LISTA_FIIS,
    LISTA_BDRS,
    _ensure_rf_catalog_schema,
    rf_catalog_list,
    rf_catalog_create,
    rf_catalog_update,
    rf_catalog_delete,
    _ensure_goals_schema,
    get_goals,
    save_goals,
    compute_goals_projection,
    obter_preco_historico,
    obter_preco_atual,
    simular_choques_indexadores,
    obter_cenarios_predefinidos,
    executar_monte_carlo,
)
from fii_scraper import obter_metadata_fii
from models import cache
import requests
try:
    import cloudscraper 
except Exception:
    cloudscraper = None

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))

server = Flask(
    __name__,
    static_folder=FRONTEND_DIST,
    static_url_path=''
)


try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    server.wsgi_app = ProxyFix(server.wsgi_app, x_proto=1, x_host=1)
except Exception:
    pass


try:
    from flask_compress import Compress
    Compress(server)
except Exception:
    pass


try:
    cache.init_app(server)
except Exception:
    pass


try:
    FRONTEND_ORIGIN = os.getenv('FRONTEND_ORIGIN')
    allowed_origins = set()
    if FRONTEND_ORIGIN:
        allowed_origins.add(FRONTEND_ORIGIN)
  
    allowed_origins.update({
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    })
    CORS(
        server,
        supports_credentials=True,
        resources={r"/api/*": {"origins": list(allowed_origins)}},
    )
except Exception:

    CORS(server, supports_credentials=True)


try:
    criar_tabela_usuarios()
except Exception as e:
    try:
        print(f"WARN: falha ao criar tabela de usuários na inicialização: {e}")
    except Exception:
        pass


try:
    invalidar_todas_sessoes()
except Exception:
    pass




@server.route("/health", methods=["GET"]) 
def health_check():
    try:
        return jsonify({"status": "ok"}), 200
    except Exception:
        return jsonify({"status": "error"}), 500



@server.route("/api/auth/registro", methods=["POST"])
def api_registro():
    
    try:
        data = request.get_json()
        nome = data.get('nome')
        username = data.get('username')
        senha = data.get('senha')
        pergunta_seguranca = data.get('pergunta_seguranca') 
        resposta_seguranca = data.get('resposta_seguranca')  
        
        if not nome or not username or not senha:
            return jsonify({"error": "Nome, username e senha são obrigatórios"}), 400
        
 
        usuario_existente = buscar_usuario_por_username(username)
        if usuario_existente:
            return jsonify({"error": "Usuário já existe"}), 400
        
        
        resultado = cadastrar_usuario(nome, username, senha, pergunta_seguranca, resposta_seguranca)
        if resultado:

            try:
                inicializar_bancos_usuario(username)
            except Exception as _:
                pass
            return jsonify({"message": "Usuário cadastrado com sucesso"}), 201
        else:
            return jsonify({"error": "Erro ao cadastrar usuário"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/login", methods=["POST"])
def api_login():
    
    try:
        data = request.get_json()
        username = data.get('username')
        senha = data.get('senha')
        
        if not username or not senha:
            return jsonify({"error": "Username e senha são obrigatórios"}), 400
        
      
        if verificar_senha(username, senha):

            try:
                # Verificar e corrigir bancos se necessário
                from models import verificar_e_corrigir_bancos_usuario
                verificar_e_corrigir_bancos_usuario(username)
            except Exception as e:
                print(f"Erro ao verificar bancos para {username}: {e}")
                pass
            

            set_usuario_atual(username)
           
            session_token = criar_sessao(username, duracao_segundos=3600)
           
            response = make_response(jsonify({
                "message": "Login realizado com sucesso",
                "username": username
            }), 200)

           

            is_production = bool(os.getenv('FLY_APP_NAME')) or os.getenv('ENVIRONMENT') == 'production'
            try:
                forwarded_proto = (request.headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
            except Exception:
                forwarded_proto = ''
            is_secure_req = False
            try:
                is_secure_req = bool(request.is_secure) or (forwarded_proto == 'https')
            except Exception:
                is_secure_req = (forwarded_proto == 'https')
            cookie_secure = True if is_secure_req else False
            
            try:
                req_origin = (request.headers.get('Origin') or '').strip().lower()
                host_url = (request.host_url or '').strip().lower()
            except Exception:
                req_origin = ''
                host_url = ''
            is_cross_site = bool(req_origin and (req_origin not in host_url))
            cookie_samesite = 'None' if (is_production and is_cross_site) else 'Lax'

            if cookie_samesite == 'None' and not cookie_secure:
                cookie_secure = True

            
            response.set_cookie(
                'session_token',
                session_token,
                httponly=True,
                samesite=cookie_samesite,
                secure=cookie_secure
            )
            
            return response
        else:
            return jsonify({"error": "Credenciais inválidas"}), 401
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/logout", methods=["POST"])
def api_logout():

    try:
       
        from models import limpar_sessoes_expiradas, SESSION_LOCK
        import threading
        
     
        try:
            token = request.cookies.get('session_token')
            if token:
                invalidar_sessao(token)
        except Exception:
            pass
        
        
        limpar_sessoes_expiradas()
        
     
        response = make_response(jsonify({"message": "Logout realizado com sucesso"}), 200)
        response.delete_cookie('session_token')
        
      
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/usuario-atual", methods=["GET"])
def api_usuario_atual():

    try:
        usuario = get_usuario_atual()
        if usuario:
            return jsonify({"username": usuario}), 200
        else:
            return jsonify({"error": "Nenhum usuário logado"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/criar-bancos/<username>", methods=["POST"])
def api_criar_bancos(username):
    
    try:

        usuario_existente = buscar_usuario_por_username(username)
        if not usuario_existente:
            return jsonify({"error": "Usuário não encontrado"}), 404
        
       
        inicializar_bancos_usuario(username)
        
        return jsonify({
            "message": f"Bancos criados com sucesso para {username}",
            "username": username
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== APIs DE RECUPERAÇÃO DE SENHA ====================

@server.route("/api/auth/obter-pergunta", methods=["POST"])
def api_obter_pergunta():
  
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            return jsonify({"error": "Username é obrigatório"}), 400
        
        # Buscar usuário
        usuario = buscar_usuario_por_username(username)
        if not usuario:
            return jsonify({"error": "Usuário não encontrado"}), 404
        
        if not usuario.get('pergunta_seguranca'):
            return jsonify({"error": "Usuário não possui pergunta de segurança configurada"}), 400
        
        return jsonify({
            "pergunta": usuario['pergunta_seguranca']
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/verificar-resposta", methods=["POST"])
def api_verificar_resposta():
   
    try:
        data = request.get_json()
        username = data.get('username')
        resposta = data.get('resposta')
        
        if not username or not resposta:
            return jsonify({"error": "Username e resposta são obrigatórios"}), 400
        
     
        if verificar_resposta_seguranca(username, resposta):
            return jsonify({"message": "Resposta correta"}), 200
        else:
            return jsonify({"error": "Resposta incorreta"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/redefinir-senha", methods=["POST"])
def api_redefinir_senha():
   
    try:
        data = request.get_json()
        username = data.get('username')
        nova_senha = data.get('nova_senha')
        
        if not username or not nova_senha:
            return jsonify({"error": "Username e nova senha são obrigatórios"}), 400
        
        if len(nova_senha) < 6:
            return jsonify({"error": "A senha deve ter pelo menos 6 caracteres"}), 400
        
        
        if alterar_senha_direta(username, nova_senha):
            return jsonify({"message": "Senha alterada com sucesso"}), 200
        else:
            return jsonify({"error": "Erro ao alterar senha"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/atualizar-pergunta", methods=["POST"])
def api_atualizar_pergunta():
    
    try:
        data = request.get_json()
        username = data.get('username')
        pergunta = data.get('pergunta')
        resposta = data.get('resposta')
        
        if not username or not pergunta or not resposta:
            return jsonify({"error": "Username, pergunta e resposta são obrigatórios"}), 400
        
        # Atualizar pergunta de segurança
        if atualizar_pergunta_seguranca(username, pergunta, resposta):
            return jsonify({"message": "Pergunta de segurança atualizada com sucesso"}), 200
        else:
            return jsonify({"error": "Erro ao atualizar pergunta de segurança"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/auth/verificar-pergunta", methods=["POST"])
def api_verificar_pergunta():
   
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            return jsonify({"error": "Username é obrigatório"}), 400
        

        usuario = buscar_usuario_por_username(username)
        if not usuario:
            return jsonify({"error": "Usuário não encontrado"}), 404
        
       
        tem_pergunta = bool(usuario.get('pergunta_seguranca'))
        
        return jsonify({
            "tem_pergunta": tem_pergunta,
            "pergunta": usuario.get('pergunta_seguranca') if tem_pergunta else None
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== APIs REST ====================

@server.route("/api/analise/ativos", methods=["POST"])
def api_analise_ativos():
    try:
        data = request.get_json()
        tipo = data.get('tipo', 'acoes')  
        filtros = data.get('filtros', {})
        
        from models import (
            processar_ativos_acoes_com_filtros,
            processar_ativos_bdrs_com_filtros,
            processar_ativos_fiis_com_filtros
        )
        
        if tipo == 'acoes':
            dados = processar_ativos_acoes_com_filtros(
                filtros.get('roe_min', 0),
                filtros.get('dy_min', 0),
                filtros.get('pl_min', 0),
                filtros.get('pl_max', float('inf')),
                filtros.get('pvp_max', float('inf')),
                filtros.get('liq_min'),
                filtros.get('setor')
            )
        elif tipo == 'bdrs':
            dados = processar_ativos_bdrs_com_filtros(
                filtros.get('roe_min', 0),
                filtros.get('dy_min', 0),
                filtros.get('pl_min', 0),
                filtros.get('pl_max', float('inf')),
                filtros.get('pvp_max', float('inf')),
                filtros.get('liq_min'),
                filtros.get('setor')
            )
        elif tipo == 'fiis':
            dados = processar_ativos_fiis_com_filtros(
                filtros.get('dy_min', 0),
                filtros.get('dy_max', float('inf')),
                filtros.get('liq_min', 0),
                filtros.get('tipo_fii'),
                filtros.get('segmento_fii')
            )
        else:
            return jsonify({"error": "Tipo inválido"}), 400
            
        return jsonify(dados)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/listas/ativos", methods=["GET"])
def api_listas_ativos():
    try:
        tipo = (request.args.get('tipo') or '').lower()
        if tipo in ('acao','acoes','ação','ações'):
            return jsonify({"tipo":"acoes","tickers": LISTA_ACOES})
        if tipo in ('fii','fiis'):
            return jsonify({"tipo":"fiis","tickers": LISTA_FIIS})
        if tipo in ('bdr','bdrs'):
            return jsonify({"tipo":"bdrs","tickers": LISTA_BDRS})
      
        return jsonify({
            "acoes": LISTA_ACOES,
            "fiis": LISTA_FIIS,
            "bdrs": LISTA_BDRS,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route('/api/rf/catalog', methods=['GET','POST','PUT','DELETE'])
def api_rf_catalog():
    try:
        print(f"DEBUG: API rf/catalog chamada - método: {request.method}")
        
        if request.method == 'GET':
            print("DEBUG: Listando catálogo de renda fixa")
            items = rf_catalog_list()
            print(f"DEBUG: Encontrados {len(items)} itens no catálogo")
            return jsonify({ 'items': items })
        
        data = request.get_json() or {}
        print(f"DEBUG: Dados recebidos: {data}")
        
        if request.method == 'POST':
            print("DEBUG: Criando item no catálogo de renda fixa")
            res = rf_catalog_create(data)
            print(f"DEBUG: Resultado da criação: {res}")
            return jsonify(res)
        
        if request.method == 'PUT':
            id_ = int(data.get('id'))
            print(f"DEBUG: Atualizando item {id_} no catálogo")
            res = rf_catalog_update(id_, data)
            print(f"DEBUG: Resultado da atualização: {res}")
            return jsonify(res)
        
        if request.method == 'DELETE':
            id_ = int(data.get('id'))
            print(f"DEBUG: Removendo item {id_} do catálogo")
            res = rf_catalog_delete(id_)
            print(f"DEBUG: Resultado da remoção: {res}")
            return jsonify(res)
        
        return jsonify({"error":"Método não suportado"}), 405
    except Exception as e:
        print(f"DEBUG: Erro na API rf/catalog: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@server.route("/api/analise/resumo", methods=["GET"])
def api_analise_resumo():
    
    try:
        df_ativos = carregar_ativos()
        
        if df_ativos.empty:
            return jsonify({
                "total_ativos": 0,
                "media_dy": 0,
                "media_pl": 0,
                "media_roe": 0,
                "maior_dy": 0,
                "menor_pl": 0,
                "melhor_roe": 0,
                "ativo_maior_dy": "-",
                "ativo_menor_pl": "-",
                "ativo_melhor_roe": "-"
            })
        

        total_ativos = len(df_ativos)
        media_dy = df_ativos['dividend_yield'].mean() if 'dividend_yield' in df_ativos.columns else 0
        media_pl = df_ativos['pl'].mean() if 'pl' in df_ativos.columns else 0
        media_roe = df_ativos['roe'].mean() if 'roe' in df_ativos.columns else 0
        
      
        maior_dy = df_ativos['dividend_yield'].max() if 'dividend_yield' in df_ativos.columns else 0
        menor_pl = df_ativos['pl'].min() if 'pl' in df_ativos.columns else 0
        melhor_roe = df_ativos['roe'].max() if 'roe' in df_ativos.columns else 0
        

        ativo_maior_dy = df_ativos.loc[df_ativos['dividend_yield'].idxmax(), 'ticker'] if 'dividend_yield' in df_ativos.columns and not df_ativos['dividend_yield'].isnull().all() else '-'
        ativo_menor_pl = df_ativos.loc[df_ativos['pl'].idxmin(), 'ticker'] if 'pl' in df_ativos.columns and not df_ativos['pl'].isnull().all() else '-'
        ativo_melhor_roe = df_ativos.loc[df_ativos['roe'].idxmax(), 'ticker'] if 'roe' in df_ativos.columns and not df_ativos['roe'].isnull().all() else '-'
        
        return jsonify({
            "total_ativos": total_ativos,
            "media_dy": float(media_dy),
            "media_pl": float(media_pl),
            "media_roe": float(media_roe),
            "maior_dy": float(maior_dy),
            "menor_pl": float(menor_pl),
            "melhor_roe": float(melhor_roe),
            "ativo_maior_dy": str(ativo_maior_dy),
            "ativo_menor_pl": str(ativo_menor_pl),
            "ativo_melhor_roe": str(ativo_melhor_roe)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/start_load", methods=["POST"])
def api_iniciar():
    carregar_ativos()
    return jsonify({"status": "Carregamento iniciado"}), 202

@server.route("/api/get_data", methods=["GET"])
def api_get_data():
    df = global_state.get("df_ativos")
    return jsonify(df.to_dict("records") if isinstance(df, pd.DataFrame) else [])

@server.route("/api/ativo/<ticker>", methods=["GET"])
def api_get_ativo_details(ticker):
    try:
        ticker = ticker.strip().upper()
        
        if '-' not in ticker and '.' not in ticker and len(ticker) <= 6:
            ticker += '.SA'
        
        acao = yf.Ticker(ticker)
        info = acao.info or {}
        historico = acao.history(period="max")
        dividends = acao.dividends if hasattr(acao, 'dividends') else None
        # ==================== MÉTRICAS DERIVADAS E FUNDAMENTOS ====================
        try:
            total_debt = None
            total_cash = None
            # fontes possíveis no info
            try:
                td = info.get('totalDebt')
                if td is not None:
                    total_debt = float(td)
            except Exception:
                pass
            for cash_key in ('totalCash', 'totalCashAndShortTermInvestments', 'cash'):
                try:
                    c = info.get(cash_key)
                    if c is not None:
                        total_cash = float(c)
                        break
                except Exception:
                    continue

            # tentativa de complementar via balanço patrimonial
            if (total_debt is None or total_cash is None):
                try:
                    bs = getattr(acao, 'balance_sheet', None)
                    if bs is not None and not bs.empty:
                        # pegar coluna mais recente
                        latest_col = bs.columns[0]
                        if total_debt is None:
                            for k in ('TotalDebt', 'LongTermDebt', 'ShortLongTermDebt'):
                                if k in bs.index:
                                    try:
                                        val = float(bs.loc[k, latest_col] or 0)
                                        total_debt = (total_debt or 0.0) + (val if val is not None else 0.0)
                                    except Exception:
                                        pass
                        if total_cash is None:
                            for k in ('Cash', 'CashAndCashEquivalents', 'CashAndShortTermInvestments'):
                                if k in bs.index:
                                    try:
                                        total_cash = float(bs.loc[k, latest_col])
                                        break
                                    except Exception:
                                        pass
                except Exception:
                    pass

            # EBITDA
            ebitda_val = None
            try:
                eb = info.get('ebitda')
                if eb is not None:
                    ebitda_val = float(eb)
            except Exception:
                pass

            # income statement: linha 'EBITDA'
            if ebitda_val is None:
                try:
                    inc = getattr(acao, 'income_stmt', None)
                    if inc is not None and not inc.empty:
                        latest_col = inc.columns[0]
                        for k in ('EBITDA', 'Ebitda'):
                            if k in inc.index:
                                try:
                                    ebitda_val = float(inc.loc[k, latest_col])
                                    break
                                except Exception:
                                    pass
                except Exception:
                    pass

            # fallback: operatingIncome + depreciationAndAmortization
            if ebitda_val is None:
                try:
                    inc = getattr(acao, 'income_stmt', None)
                    cf = getattr(acao, 'cashflow', None)
                    op_inc = None
                    dep_amort = None
                    if inc is not None and not inc.empty and 'OperatingIncome' in inc.index:
                        latest_col = inc.columns[0]
                        try:
                            op_inc = float(inc.loc['OperatingIncome', latest_col])
                        except Exception:
                            op_inc = None
                    if cf is not None and not cf.empty:
                        latest_col_cf = cf.columns[0]
                        for k in ('DepreciationAndAmortization', 'Depreciation', 'DepreciationAmortizationDepletion'):
                            if k in cf.index:
                                try:
                                    dep_amort = float(cf.loc[k, latest_col_cf])
                                    break
                                except Exception:
                                    pass
                    if op_inc is not None and dep_amort is not None:
                        ebitda_val = float(op_inc) + float(dep_amort)
                except Exception:
                    pass

            net_debt = None
            net_debt_to_ebitda = None
            try:
                if total_debt is not None or total_cash is not None:
                    net_debt = float(total_debt or 0.0) - float(total_cash or 0.0)
            except Exception:
                net_debt = None
            try:
                if net_debt is not None and ebitda_val and float(ebitda_val) != 0.0:
                    net_debt_to_ebitda = float(net_debt) / float(ebitda_val)
            except Exception:
                net_debt_to_ebitda = None

            # publicar no payload dentro de info para reaproveitar componentes atuais
            if net_debt is not None:
                info['netDebt'] = net_debt
            if net_debt_to_ebitda is not None:
                info['netDebtToEbitda'] = net_debt_to_ebitda
        except Exception:
            pass
        
        # Derivações adicionais (quando existirem campos no info ou nas demonstrações)
        try:
            # Bases
            market_cap = None
            try:
                mc = info.get('marketCap')
                market_cap = float(mc) if mc is not None else None
            except Exception:
                market_cap = None
            enterprise_value = None
            try:
                ev = info.get('enterpriseValue')
                enterprise_value = float(ev) if ev is not None else None
            except Exception:
                enterprise_value = None
            total_assets = info.get('totalAssets')
            total_current_assets = info.get('totalCurrentAssets')
            total_current_liab = info.get('totalCurrentLiabilities')
            total_liab = info.get('totalLiab')
            equity = info.get('totalStockholderEquity')
            price_to_sales = info.get('priceToSalesTrailing12Months')
            payout_ratio = info.get('payoutRatio')
            gross_margins = info.get('grossMargins')
            operating_margins = info.get('operatingMargins')
            profit_margins = info.get('profitMargins')
            ebitda_margins = info.get('ebitdaMargins')
            roic = info.get('returnOnInvestedCapital')
            roa = info.get('returnOnAssets')
            last_div = info.get('lastDividendValue') or info.get('lastDividend') or info.get('lastDividendDate')
            dividend_rate = info.get('dividendRate')
            # já computado acima: ebitda_val, net_debt
            # EBIT: usar operatingIncome se existir; se não, tentar ebitda - D&A
            ebit = None
            try:
                if info.get('ebit') is not None:
                    ebit = float(info.get('ebit'))
            except Exception:
                ebit = None
            if ebit is None:
                try:
                    if info.get('operatingIncome') is not None:
                        ebit = float(info.get('operatingIncome'))
                except Exception:
                    ebit = None
            if ebit is None:
                try:
                    da = info.get('depreciationAndAmortization')
                    if ebitda_val is not None and da is not None:
                        ebit = float(ebitda_val) - float(da)
                except Exception:
                    pass
            if ebit is not None:
                info['ebit'] = ebit
            
            # EV/EBITDA e EV/EBIT
            ev_ebitda = None
            try:
                ev_to_ebitda_info = info.get('enterpriseToEbitda')
                if ev_to_ebitda_info is not None:
                    ev_ebitda = float(ev_to_ebitda_info)
                elif enterprise_value is not None and ebitda_val and float(ebitda_val) != 0.0:
                    ev_ebitda = float(enterprise_value) / float(ebitda_val)
            except Exception:
                ev_ebitda = None
            if ev_ebitda is not None:
                info['evToEbitda'] = ev_ebitda
            ev_ebit = None
            try:
                if enterprise_value is not None and ebit and float(ebit) != 0.0:
                    ev_ebit = float(enterprise_value) / float(ebit)
            except Exception:
                ev_ebit = None
            if ev_ebit is not None:
                info['evToEbit'] = ev_ebit
            
            # P/EBITDA e P/EBIT
            p_ebitda = None
            try:
                if market_cap is not None and ebitda_val and float(ebitda_val) != 0.0:
                    p_ebitda = float(market_cap) / float(ebitda_val)
            except Exception:
                p_ebitda = None
            if p_ebitda is not None:
                info['pToEbitda'] = p_ebitda
            p_ebit = None
            try:
                if market_cap is not None and ebit and float(ebit) != 0.0:
                    p_ebit = float(market_cap) / float(ebit)
            except Exception:
                p_ebit = None
            if p_ebit is not None:
                info['pToEbit'] = p_ebit
            
            # P/Ativo
            p_to_assets = None
            try:
                if market_cap is not None and total_assets and float(total_assets) != 0.0:
                    p_to_assets = float(market_cap) / float(total_assets)
            except Exception:
                p_to_assets = None
            if p_to_assets is not None:
                info['pToAssets'] = p_to_assets
            
            # P/Capital de Giro (Ativo Circulante - Passivo Circulante)
            p_to_working_capital = None
            try:
                if (market_cap is not None and total_current_assets is not None and total_current_liab is not None):
                    wc = float(total_current_assets) - float(total_current_liab)
                    if wc != 0.0:
                        p_to_working_capital = float(market_cap) / wc
            except Exception:
                p_to_working_capital = None
            if p_to_working_capital is not None:
                info['pToWorkingCapital'] = p_to_working_capital
                info['pToNetCurrentAssets'] = p_to_working_capital  # alias P/Ativo Circ Líquido
            
            # Net Debt / Equity e Net Debt / EBIT
            try:
                if info.get('netDebt') is not None and equity and float(equity) != 0.0:
                    info['netDebtToEquity'] = float(info['netDebt']) / float(equity)
            except Exception:
                pass
            try:
                if info.get('netDebt') is not None and ebit and float(ebit) != 0.0:
                    info['netDebtToEbit'] = float(info['netDebt']) / float(ebit)
            except Exception:
                pass
            # Gross debt ratios
            try:
                if total_debt is not None and equity and float(equity) != 0.0:
                    info['grossDebtToEquity'] = float(total_debt) / float(equity)
            except Exception:
                pass
            # Patrimônio/Ativos, Passivos/Ativos
            try:
                if equity and total_assets and float(total_assets) != 0.0:
                    info['equityToAssets'] = float(equity) / float(total_assets)
            except Exception:
                pass
            try:
                if total_liab and total_assets and float(total_assets) != 0.0:
                    info['liabilitiesToAssets'] = float(total_liab) / float(total_assets)
            except Exception:
                pass
            # Liquidez Corrente
            try:
                if info.get('currentRatio') is None and total_current_assets and total_current_liab and float(total_current_liab) != 0.0:
                    info['currentRatio'] = float(total_current_assets) / float(total_current_liab)
            except Exception:
                pass
            # Giro de Ativos
            try:
                total_revenue = info.get('totalRevenue')
                if total_revenue and total_assets and float(total_assets) != 0.0:
                    info['assetTurnover'] = float(total_revenue) / float(total_assets)
            except Exception:
                pass
            # PSR e payout já expostos pelo info, apenas manter nomes
            if price_to_sales is not None:
                info['psr'] = price_to_sales
            if payout_ratio is not None:
                info['payoutRatio'] = payout_ratio
            if gross_margins is not None:
                info['grossMargins'] = gross_margins
            if operating_margins is not None:
                info['operatingMargins'] = operating_margins
            if profit_margins is not None:
                info['profitMargins'] = profit_margins
            if ebitda_margins is not None:
                info['ebitdaMargins'] = ebitda_margins
            if roic is not None:
                info['returnOnInvestedCapital'] = roic
            if roa is not None:
                info['returnOnAssets'] = roa
            if last_div is not None:
                info['lastDiv'] = last_div
            if dividend_rate is not None:
                info['dividendRate'] = dividend_rate
            # CAGRs (tentativa a partir de statements anuais)
            try:
                rev_cagr_5 = None
                earn_cagr_5 = None
                inc = getattr(acao, 'income_stmt', None)
                if inc is not None and not inc.empty:
                    cols = list(inc.columns)
                    cols_sorted = sorted(cols)  # ordem ascendente
                    if len(cols_sorted) >= 2:
                        # Encontrar revenue e net income
                        rev_keys = ('TotalRevenue', 'Total Revenue')
                        ni_keys = ('NetIncome', 'Net Income', 'Net Income Common Stockholders')
                        def get_line(keys):
                            for k in keys:
                                if k in inc.index:
                                    return inc.loc[k, :]
                            return None
                        rev_line = get_line(rev_keys)
                        ni_line = get_line(ni_keys)
                        def cagr_from_line(line):
                            if line is None:
                                return None
                            try:
                                start = float(line.iloc[0] or 0.0)
                                end = float(line.iloc[-1] or 0.0)
                                n = max(1, len(line)-1)
                                if start > 0 and end > 0:
                                    return (end / start) ** (1.0 / n) - 1.0
                            except Exception:
                                return None
                            return None
                        rev_cagr_5 = cagr_from_line(rev_line)
                        earn_cagr_5 = cagr_from_line(ni_line)
                if rev_cagr_5 is not None:
                    info['revenueCagr5y'] = rev_cagr_5
                if earn_cagr_5 is not None:
                    info['earningsCagr5y'] = earn_cagr_5
            except Exception:
                pass
        except Exception:
            pass
        
        def convert_timestamps(obj):
            if isinstance(obj, dict):
                return {k: convert_timestamps(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_timestamps(item) for item in obj]
            elif hasattr(obj, 'isoformat'): 
                return obj.isoformat()
            else:
                return obj
        
        historico_json = []
        if historico is not None and not historico.empty:
            for index, row in historico.iterrows():
                row_dict = row.to_dict()
                row_dict['Date'] = index.isoformat()
                historico_json.append(row_dict)
        
        dividends_json = {}
        if dividends is not None and not dividends.empty:
            for index, value in dividends.items():
                dividends_json[index.isoformat()] = float(value)


        fii_extra = None
        try:
            
            is_brazilian_fii = ticker.endswith('11.SA') or ticker.endswith('11')
            if is_brazilian_fii:
                current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')

                dy_12m = None
                dividendo_medio_12m = None
                ultimo_rendimento_valor = None
                ultimo_rendimento_data = None
                if dividends is not None and not dividends.empty and current_price:
                    from datetime import datetime, timedelta
                    cutoff = datetime.utcnow() - timedelta(days=365)
                   
                    last_12m = dividends[dividends.index >= cutoff]
                    soma_12m = float(last_12m.sum()) if last_12m is not None else 0.0
                    dy_12m = (soma_12m / float(current_price) * 100.0) if current_price and soma_12m is not None else None
                
                    if last_12m is not None and len(last_12m) > 0:
                        dividendo_medio_12m = float(soma_12m / len(last_12m))
                 
                    try:
                        ultimo_rendimento_valor = float(dividends.iloc[-1])
                        ultimo_rendimento_data = dividends.index[-1].isoformat()
                    except Exception:
                        pass


                summary = (info.get('longBusinessSummary') or '').lower()
                fii_tipo = None
                segmento = None
                if any(k in summary for k in ['híbrido', 'hibrido', 'hybrid']):
                    fii_tipo = 'Híbrido'
                elif any(k in summary for k in ['recebível', 'recebiveis', 'cri', 'crédito imobiliário', 'credito imobiliario', 'papel']):
                    fii_tipo = 'Papel'
                elif any(k in summary for k in ['shopping', 'logística', 'logistica', 'laje', 'lajes', 'galpão', 'galpao', 'escritório', 'escritorio', 'residencial', 'industrial', 'hospital', 'educacional']):
                    fii_tipo = 'Tijolo'


                segmentos = ['shopping', 'logística', 'logistica', 'lajes corporativas', 'escritórios', 'escritorios', 'residencial', 'industrial', 'hospitalar', 'educacional', 'galpões', 'galpoes']
                for seg in segmentos:
                    if seg in summary:
                        segmento = seg.capitalize()
                        break
                if not segmento and fii_tipo == 'Papel':
                    segmento = 'Recebíveis/CRI'

   
                pvp = info.get('priceToBook')
                vp_por_cota = (float(current_price) / float(pvp)) if current_price and pvp not in (None, 0) else None

                fii_extra = {
                    'tipo': fii_tipo,  # Tijolo | Papel | Híbrido | None
                    'segmento': segmento,  # Ex.: Shopping, Logística, etc.
                    'gestora': info.get('fundFamily') or None,
                    'administradora': info.get('legalType') or None,
                    'vacancia': None,  # Não disponível no yfinance
                    'patrimonio_liquido': info.get('totalAssets'),
                    'num_cotistas': None,
                    'num_imoveis': None,
                    'vp_por_cota': vp_por_cota,
                    'dy_12m': dy_12m,
                    'dividendo_medio_12m': dividendo_medio_12m,
                    'ultimo_rendimento_valor': ultimo_rendimento_valor,
                    'ultimo_rendimento_data': ultimo_rendimento_data,
                }
        except Exception as _:
            fii_extra = None
        
        dados = {
            "info": info,
            "historico": historico_json,
            "dividends": dividends_json,
            "fii": fii_extra
        }
        
        return jsonify(dados)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/fii-metadata/<ticker>", methods=["GET"])
@cache.cached(timeout=3600, query_string=True)  # Cache de 1 hora
def api_get_fii_metadata(ticker):

    try:
        ticker = ticker.strip().upper()
        
        # Verificar se é FII brasileiro
        is_fii = ticker.endswith('11') or ticker.endswith('11.SA')
        if not is_fii:
            return jsonify({"error": "Ticker não parece ser um FII brasileiro"}), 400
        
        # Buscar metadados via scraping
        metadata = obter_metadata_fii(ticker)
        
        if metadata:
            return jsonify(metadata), 200
        else:
            return jsonify({
                "error": "Não foi possível obter metadados do FII",
                "ticker": ticker
            }), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/ativo/<ticker>/historico", methods=["GET"])
def api_get_ativo_historico(ticker):
    try:
        periodo = request.args.get('periodo', '1y')
        ticker = ticker.strip().upper()
        if '-' not in ticker and '.' not in ticker and len(ticker) <= 6:
            ticker += '.SA'
        
        acao = yf.Ticker(ticker)
        historico = acao.history(period=periodo)
        
        if periodo != "max" and historico is not None and not historico.empty:
            if periodo.endswith("mo"):
                meses = int(periodo.replace("mo", ""))
                dt_ini = historico.index.max() - timedelta(days=30*meses)
            elif periodo.endswith("y"):
                anos = int(periodo.replace("y", ""))
                dt_ini = historico.index.max() - timedelta(days=365*anos)
            else:
                dt_ini = historico.index.min()
            
            historico = historico[historico.index >= dt_ini]
        
        historico_json = []
        if historico is not None and not historico.empty:
            for index, row in historico.iterrows():
                row_dict = row.to_dict()
                row_dict['Date'] = index.isoformat()
                historico_json.append(row_dict)
        
        return jsonify(historico_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/ativo/<ticker>/preco-historico", methods=["GET"])
def api_get_preco_historico(ticker):
   
    try:
        data = request.args.get('data')
        if not data:
            return jsonify({"error": "Parâmetro 'data' é obrigatório (formato: YYYY-MM-DD)"}), 400
        
        
        try:
            datetime.strptime(data, '%Y-%m-%d')
        except ValueError:
            return jsonify({"error": "Formato de data inválido. Use YYYY-MM-DD"}), 400
        
        resultado = obter_preco_historico(ticker, data)
        
        if resultado:
            return jsonify(resultado)
        else:
            return jsonify({"error": f"Preço histórico não encontrado para {ticker} na data {data}"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/ativo/<ticker>/preco-atual", methods=["GET"])
def api_get_preco_atual(ticker):
   
    try:
        resultado = obter_preco_atual(ticker)
        
        if resultado:
            return jsonify(resultado)
        else:
            return jsonify({"error": f"Preço atual não encontrado para {ticker}"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _buscar_info_ticker_para_comparacao(ticker):
    """
    Função auxiliar para buscar informações de um ticker.
    Usada para paralelização no endpoint /api/comparar.
    """
    try:
        ticker_original = ticker.strip().upper()
        if '.' not in ticker_original and len(ticker_original) <= 6:
            ticker_yf = ticker_original + '.SA'
        else:
            ticker_yf = ticker_original
            
        acao = yf.Ticker(ticker_yf)
        info = acao.info or {}
        
        return {
            "ticker": ticker_original,
            "nome": info.get('longName', '-'),
            "preco_atual": info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'),
            "pl": info.get('trailingPE'),
            "pvp": info.get('priceToBook'),
            "dy": info.get('dividendYield'),
            "roe": info.get('returnOnEquity'),
            "setor": info.get('sector', '-'),
            "pais": info.get('country', '-'),
        }
    except Exception as e:
        return {
            "ticker": ticker.strip().upper(),
            "nome": f"Erro: {str(e)}",
            "preco_atual": None,
            "pl": None,
            "pvp": None,
            "dy": None,
            "roe": None,
            "setor": "-",
            "pais": "-"
        }

@server.route("/api/comparar", methods=["POST"])
def api_comparar_ativos():
    try:
        data = request.get_json()
        tickers = data.get('tickers', [])
        
        if not tickers:
            return jsonify({"error": "Nenhum ticker fornecido"}), 400
        
        # OTIMIZAÇÃO: Aumentado para 200 workers para processar muito mais rápido
        resultados = []
        max_workers = min(len(tickers), 200)  # Até 200 workers simultâneos
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submete todas as tarefas de uma vez
            future_to_ticker = {
                executor.submit(_buscar_info_ticker_para_comparacao, ticker): ticker 
                for ticker in tickers
            }
            
            # Coleta resultados conforme terminam (mantém ordem original)
            # Delay menor (a cada 50 requisições) para não sobrecarregar yfinance
            import time
            ticker_to_result = {}
            completed_count = 0
            for future in as_completed(future_to_ticker):
                resultado = future.result()
                ticker_to_result[resultado["ticker"]] = resultado
                completed_count += 1
                # Delay a cada 50 requisições para evitar rate limit do yfinance
                if completed_count % 50 == 0:
                    time.sleep(0.1)  # 100ms de pausa
            
            # Reordena resultados para manter ordem original dos tickers
            for ticker in tickers:
                ticker_normalized = ticker.strip().upper()
                if ticker_normalized in ticker_to_result:
                    resultados.append(ticker_to_result[ticker_normalized])
                else:
                    # Fallback caso não encontre (não deveria acontecer)
                    resultados.append({
                        "ticker": ticker_normalized,
                        "nome": "Erro: Ticker não processado",
                    "preco_atual": None,
                    "pl": None,
                    "pvp": None,
                    "dy": None,
                    "roe": None,
                    "setor": "-",
                    "pais": "-"
                })
        
        return jsonify(resultados)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/tickers/sugestoes", methods=["GET"])
def api_get_ticker_sugestoes():
    try:
        ativos = obter_carteira()
        opcoes = [{"label": f"{a['ticker']} - {a['nome_completo']}", "value": a['ticker']} for a in ativos]
        
        exemplos = [
            {"label": "PETR4.SA - Petrobras", "value": "PETR4.SA"},
            {"label": "ITUB4.SA - Itaú Unibanco", "value": "ITUB4.SA"},
            {"label": "BOVA11.SA - BOVA11 ETF", "value": "BOVA11.SA"},
            {"label": "AAPL - Apple", "value": "AAPL"},
            {"label": "MSFT - Microsoft", "value": "MSFT"},
            {"label": "TSLA - Tesla", "value": "TSLA"},
        ]
        
        tickers_existentes = set([o['value'] for o in opcoes])
        for ex in exemplos:
            if ex['value'] not in tickers_existentes:
                opcoes.append(ex)
        
        return jsonify(opcoes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/logo/<ticker>", methods=["GET"])
def api_get_logo_url(ticker):
    try:
        from complete_b3_logos_mapping import get_logo_url
        logo_url = get_logo_url(ticker)
        return jsonify({"logo_url": logo_url})
    except Exception as e:
        import traceback
        print(f"[ERRO] Erro ao buscar logo para {ticker}: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@server.route("/api/logos", methods=["POST"])
def api_get_logos_batch():
    try:
        data = request.get_json() or {}
        tickers = data.get('tickers') or []
        if not isinstance(tickers, list):
            return jsonify({"error": "tickers deve ser lista"}), 400
        from complete_b3_logos_mapping import get_logo_url
        out = {}
        for t in tickers[:500]:
            try:
                out[t] = get_logo_url(str(t))
            except Exception as e:
                print(f"[ERRO] Erro ao buscar logo para {t}: {e}")
                out[t] = None
        return jsonify({"logos": out})
    except Exception as e:
        import traceback
        print(f"[ERRO] Erro ao buscar logos em batch: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# ==================== SERVE FRONTEND (SPA) ====================

@server.route('/', defaults={'path': ''})
@server.route('/<path:path>')
def serve_frontend(path):
    
    if path.startswith('api/'):
        return jsonify({"error": "Not Found"}), 404

 
    requested_path = os.path.join(server.static_folder, path) if path else None
    if path and os.path.exists(requested_path):
        return send_from_directory(server.static_folder, path)
    
    if path in ('sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'):
        return send_from_directory(server.static_folder, path)


    index_path = os.path.join(server.static_folder, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(server.static_folder, 'index.html')
    return jsonify({"message": "Frontend não construído. Rode npm run build em frontend/"}), 200





@server.errorhandler(404)
def spa_404_fallback(_e):
    try:
        # Não interceptar APIs
        req_path = (request.path or '').lstrip('/')
        if req_path.startswith('api/'):
            return jsonify({"error": "Not Found"}), 404
        # Permitir arquivos PWA conhecidos
        if req_path in ('sw.js', 'manifest.webmanifest', 'favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'):
            return send_from_directory(server.static_folder, req_path)
        # Devolver index.html para qualquer outra rota (SPA)
        index_path = os.path.join(server.static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(server.static_folder, 'index.html')
    except Exception:
        pass
    return jsonify({"error": "Not Found"}), 404

# ==================== APIs DE CARTEIRA ====================

@server.route("/api/carteira", methods=["GET"])
def api_get_carteira():
    
    try:
        # Proteção contra troca de usuário entre abas: valida o usuário esperado (opcional)
        try:
            expected_user = (request.headers.get('X-User-Expected') or '').strip().lower()
        except Exception:
            expected_user = ''
        refresh = request.args.get('refresh') in ('1', 'true', 'True')
   
        usuario_atual = get_usuario_atual()
        print(f"DEBUG - Carteira: Usuário atual = {usuario_atual}")
        if expected_user and usuario_atual and expected_user != str(usuario_atual).strip().lower():
            return jsonify({"error": "User mismatch", "current_user": usuario_atual}), 409
       
        if refresh:
            try:
                atualizar_precos_indicadores_carteira()
                if usuario_atual and cache:
                    cache.delete(f"carteira:{usuario_atual}")
                    cache.delete(f"carteira_insights:{usuario_atual}")
            except Exception as _:
                pass

        cache_key = f"carteira:{usuario_atual}" if (usuario_atual and not refresh) else None
        if cache_key and cache:
            cached = cache.get(cache_key)
            if cached is not None:
                return jsonify(cached)
        carteira = obter_carteira()
        if cache_key and cache:
            try:
                cache.set(cache_key, carteira, timeout=600)  # 10 minutos
            except Exception:
                pass
        return jsonify(carteira)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/com-metadados-fii", methods=["GET"])
def api_carteira_com_metadados_fii():
    """API para obter carteira com metadados de FIIs (usado apenas quando necessário)"""
    try:
        carteira = obter_carteira_com_metadados_fii()
        return jsonify(carteira)
    except Exception as e:
        print(f"Erro na API carteira com metadados FII: {e}")
        return jsonify({"error": str(e)}), 500


@server.route("/api/carteira/refresh", methods=["POST"])
def api_refresh_carteira():
    try:
        # Proteção contra troca de usuário entre abas: valida o usuário esperado (opcional)
        try:
            expected_user = (request.headers.get('X-User-Expected') or '').strip().lower()
        except Exception:
            expected_user = ''
        actual_user = get_usuario_atual()
        if expected_user and actual_user and expected_user != str(actual_user).strip().lower():
            return jsonify({"error": "User mismatch", "current_user": actual_user}), 409
        print("DEBUG: Iniciando refresh da carteira...")
        result = atualizar_precos_indicadores_carteira()
        print(f"DEBUG: Resultado do refresh: {result}")
        
        
        try:
            usuario_atual = get_usuario_atual()
            if usuario_atual and cache:
                cache.delete(f"carteira:{usuario_atual}")
                cache.delete(f"carteira_insights:{usuario_atual}")
        except Exception:
            pass
        
        if not result.get("success"):
            return jsonify(result), 500
        return jsonify(result)
    except Exception as e:
        print(f"DEBUG: Erro no refresh da carteira: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@server.route("/api/carteira/refresh-indexadores", methods=["POST"])
def api_refresh_indexadores():
  
    try:
        # Proteção contra troca de usuário entre abas: valida o usuário esperado (opcional)
        try:
            expected_user = (request.headers.get('X-User-Expected') or '').strip().lower()
        except Exception:
            expected_user = ''
        actual_user = get_usuario_atual()
        if expected_user and actual_user and expected_user != str(actual_user).strip().lower():
            return jsonify({"error": "User mismatch", "current_user": actual_user}), 409
        print("DEBUG: Iniciando refresh específico de indexadores...")
        result = atualizar_precos_indicadores_carteira()
        print(f"DEBUG: Resultado do refresh de indexadores: {result}")
 
        try:
            usuario_atual = get_usuario_atual()
            if usuario_atual and cache:
                cache.delete(f"carteira:{usuario_atual}")
                cache.delete(f"carteira_insights:{usuario_atual}")
        except Exception:
            pass
        
        if not result.get("success"):
            return jsonify(result), 500
        return jsonify(result)
    except Exception as e:
        print(f"DEBUG: Erro no refresh de indexadores: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ==================== BATCH REQUESTS ====================

@server.route("/api/batch", methods=["POST"])
def api_batch():
    """
    Endpoint para agrupar múltiplas requisições em uma única chamada HTTP.
    Reduz latência e overhead de múltiplas conexões.
    
    PROTEÇÕES DE SEGURANÇA:
    1. Valida autenticação do usuário
    2. Valida header X-User-Expected
    3. Cada endpoint interno valida usuário novamente
    4. Isolamento garantido por schema do PostgreSQL
    """
    try:
        # PROTEÇÃO 1: Validar autenticação
        usuario_atual = get_usuario_atual()
        if not usuario_atual:
            return jsonify({"error": "Não autenticado"}), 401
        
        # PROTEÇÃO 2: Validar header X-User-Expected
        try:
            expected_user = (request.headers.get('X-User-Expected') or '').strip().lower()
        except Exception:
            expected_user = ''
        
        if expected_user and expected_user != str(usuario_atual).strip().lower():
            return jsonify({"error": "User mismatch", "current_user": usuario_atual}), 409
        
        # Obter lista de requisições
        data = request.get_json() or {}
        requests_list = data.get('requests', [])
        
        if not requests_list:
            return jsonify({"error": "Nenhuma requisição especificada"}), 400
        
        # Limitar número de requisições por batch (segurança)
        if len(requests_list) > 20:
            return jsonify({"error": "Máximo de 20 requisições por batch"}), 400
        
        results = {}
        
        # Processar cada requisição
        for req in requests_list:
            endpoint = req.get('endpoint', '').strip()
            method = req.get('method', 'GET').upper()
            params = req.get('params', {})
            body = req.get('body', {})
            
            if not endpoint:
                continue
            
            try:
                # Mapear endpoints para funções internas
                # Cada função valida usuário internamente
                if endpoint == '/carteira' and method == 'GET':
                    refresh = params.get('refresh', False)
                    if refresh:
                        try:
                            atualizar_precos_indicadores_carteira()
                            if usuario_atual and cache:
                                cache.delete(f"carteira:{usuario_atual}")
                                cache.delete(f"carteira_insights:{usuario_atual}")
                        except Exception:
                            pass
                    carteira = obter_carteira()
                    results[endpoint] = carteira
                
                elif endpoint == '/indicadores' and method == 'GET':
                    # Função inline do endpoint original
                    def sgs_last(series_id, use_range=False):
                        if use_range:
                            end_date = datetime.now()
                            start_date = end_date - timedelta(days=90)
                            url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados?"
                                   f"formato=json&dataInicial={start_date.strftime('%d/%m/%Y')}"
                                   f"&dataFinal={end_date.strftime('%d/%m/%Y')}")
                            r = requests.get(url, timeout=10)
                            r.raise_for_status()
                            arr = r.json()
                            return arr[-1] if arr else None
                        else:
                            url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados/ultimos/1?formato=json"
                            r = requests.get(url, timeout=10)
                            r.raise_for_status()
                            arr = r.json()
                            return arr[0] if arr else None
                    
                    selic = sgs_last(432, use_range=True)
                    cdi = sgs_last(12, use_range=True)
                    ipca = sgs_last(433)
                    results[endpoint] = {"selic": selic, "cdi": cdi, "ipca": ipca}
                
                elif endpoint == '/carteira/proventos-recebidos' and method == 'GET':
                    # Usar a mesma lógica do endpoint api_get_proventos_recebidos
                    periodo = params.get('periodo', 'total')
                    carteira = obter_carteira()
                    if not carteira:
                        results[endpoint] = []
                    else:
                        # Calcular data de início baseada no período
                        data_inicio = None
                        if periodo != 'total':
                            hoje = datetime.now()
                            if periodo == 'mes':
                                data_inicio = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                            elif periodo == '6meses':
                                data_inicio = hoje - timedelta(days=180)
                                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
                            elif periodo == '1ano':
                                data_inicio = hoje - timedelta(days=365)
                                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
                            elif periodo == '5anos':
                                data_inicio = hoje - timedelta(days=365*5)
                                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
                        
                        # Buscar proventos em paralelo usando função existente
                        # OTIMIZAÇÃO: Reduzido de 10 para 5 workers para evitar sobrecarga de RAM no Render
                        resultado = []
                        max_workers = min(len(carteira), 200)  # Até 200 workers simultâneos
                        
                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            future_to_ativo = {
                                executor.submit(_buscar_proventos_ativo, ativo, data_inicio): ativo 
                                for ativo in carteira
                            }
                            
                            for future in as_completed(future_to_ativo):
                                try:
                                    resultado_ativo = future.result()
                                    if resultado_ativo:
                                        resultado.append(resultado_ativo)
                                except Exception as e:
                                    print(f"Erro ao buscar proventos: {e}")
                                    continue
                        
                        results[endpoint] = resultado
                
                elif endpoint == '/carteira/historico' and method == 'GET':
                    periodo = params.get('periodo', 'mensal')
                    historico = obter_historico_carteira(periodo)
                    results[endpoint] = historico
                
                elif endpoint == '/goals' and method == 'GET':
                    from models import get_goals, _ensure_goals_schema
                    _ensure_goals_schema()
                    goals = get_goals() or {}
                    results[endpoint] = goals
                
                elif endpoint == '/home/resumo' and method == 'GET':
                    # Extrair lógica do endpoint api_home_resumo
                    mes = params.get('mes')
                    ano = params.get('ano')
                    if not mes or not ano:
                        results[endpoint] = {"error": "Mês e ano são obrigatórios"}
                    else:
                        carteira = obter_carteira()
                        total_investido = sum(ativo.get('valor_total', 0) for ativo in carteira)
                        ativos_por_tipo = {}
                        for ativo in carteira:
                            tipo = ativo.get('tipo', 'Desconhecido')
                            ativos_por_tipo[tipo] = ativos_por_tipo.get(tipo, 0) + ativo.get('valor_total', 0)
                        
                        df_receitas = carregar_receitas_mes_ano(mes, ano)
                        receitas = df_receitas.to_dict('records') if not df_receitas.empty else []
                        total_receitas = df_receitas['valor'].sum() if not df_receitas.empty else 0
                        
                        total_cartoes = 0
                        
                        outros = carregar_outros_mes_ano(mes, ano)
                        total_outros = sum(outro.get('valor', 0) for outro in outros)
                        
                        marmitas = consultar_marmitas(mes, ano)
                        marmitas_formatted = []
                        total_marmitas = 0
                        for registro in marmitas:
                            marmita = {
                                'id': registro[0],
                                'data': registro[1],
                                'valor': float(registro[2]) if registro[2] else 0,
                                'comprou': bool(registro[3])
                            }
                            marmitas_formatted.append(marmita)
                            total_marmitas += marmita['valor']
                        
                        saldo = calcular_saldo_mes_ano(mes, ano)
                        
                        # Evolução diária
                        df_receita = carregar_receitas_mes_ano(mes, ano)
                        df_outros = pd.DataFrame(carregar_outros_mes_ano(mes, ano))
                        
                        if not df_receita.empty:
                            df_receita["data"] = pd.to_datetime(df_receita["data"])
                            df_receita_grouped = df_receita.groupby("data")["valor"].sum().reset_index(name="receitas")
                        else:
                            df_receita_grouped = pd.DataFrame(columns=["data", "receitas"])
                        
                        df_outros["data"] = pd.to_datetime(df_outros["data"]) if not df_outros.empty else pd.Series(dtype='datetime64[ns]')
                        df_outros_ = df_outros[["data", "valor"]] if not df_outros.empty else pd.DataFrame(columns=["data", "valor"])
                        df_despesas = df_outros_ if not df_outros_.empty else pd.DataFrame(columns=["data", "valor"])
                        
                        if df_despesas.empty:
                            df_despesas_grouped = pd.DataFrame({"data": [], "despesas": []})
                        else:
                            df_despesas_grouped = df_despesas.groupby("data")["valor"].sum().reset_index(name="despesas")
                        
                        dias = pd.date_range(
                            start=f"{ano}-{mes.zfill(2)}-01", 
                            end=pd.Timestamp(f"{ano}-{mes.zfill(2)}-01") + pd.offsets.MonthEnd(0)
                        )
                        df_base = pd.DataFrame({"data": dias})
                        
                        df_merged = pd.merge(df_base, df_receita_grouped, on="data", how="left").merge(df_despesas_grouped, on="data", how="left")
                        df_merged["receitas"] = df_merged["receitas"].fillna(0)
                        df_merged["despesas"] = df_merged["despesas"].fillna(0)
                        df_merged["saldo_dia"] = df_merged["receitas"] - df_merged["despesas"]
                        df_merged["saldo_acumulado"] = df_merged["saldo_dia"].cumsum()
                        
                        evolucao_diaria = []
                        for _, row in df_merged.iterrows():
                            evolucao_diaria.append({
                                'data': row['data'].strftime('%Y-%m-%d'),
                                'receitas': float(row['receitas']),
                                'despesas': float(row['despesas']),
                                'saldo_dia': float(row['saldo_dia']),
                                'saldo_acumulado': float(row['saldo_acumulado'])
                            })
                        
                        resumo = {
                            "carteira": {
                                "total_investido": float(total_investido),
                                "ativos_por_tipo": {k: float(v) for k, v in ativos_por_tipo.items()}
                            },
                            "receitas": {
                                "registros": receitas,
                                "total": float(total_receitas)
                            },
                            "cartoes": {
                                "registros": [],
                                "total": float(total_cartoes)
                            },
                            "outros": {
                                "registros": outros,
                                "total": float(total_outros)
                            },
                            "marmitas": {
                                "registros": marmitas_formatted,
                                "total": float(total_marmitas)
                            },
                            "saldo": float(saldo),
                            "evolucao_diaria": evolucao_diaria
                        }
                        
                        results[endpoint] = resumo
                
                else:
                    results[endpoint] = {"error": f"Endpoint não suportado: {endpoint} {method}"}
            
            except Exception as e:
                print(f"Erro ao processar {endpoint}: {str(e)}")
                results[endpoint] = {"error": str(e)}
        
        return jsonify(results)
    
    except Exception as e:
        print(f"Erro no batch request: {str(e)}")
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/insights", methods=["GET"])
def api_carteira_insights():
    try:
        usuario_atual = get_usuario_atual()
        if not usuario_atual:
            return jsonify({"error": "Não autenticado"}), 401
        cache_key = f"carteira_insights:{usuario_atual}"
        if cache:
            cached = cache.get(cache_key)
            if cached is not None:
                return jsonify(cached)

        itens = obter_carteira() or []
        total_investido = float(sum((it.get('valor_total') or 0.0) for it in itens)) if itens else 0.0
        num_ativos = len(itens)
        tipos_map = {}
        for it in itens:
            tipos_map[it.get('tipo') or 'Desconhecido'] = tipos_map.get(it.get('tipo') or 'Desconhecido', 0) + (it.get('valor_total') or 0.0)

        
        enriched = []
        for it in itens:
            valor = float(it.get('valor_total') or 0.0)
            pct = (valor / total_investido * 100.0) if total_investido > 0 else 0.0
            enriched.append({
                **it,
                'percentual_carteira': pct
            })
        top_positions = sorted(enriched, key=lambda x: x.get('valor_total') or 0.0, reverse=True)[:5]

   
        concentration_alerts = []
        for it in enriched:
            if it['percentual_carteira'] > 25.0:
                concentration_alerts.append({
                    'ticker': it['ticker'],
                    'percentual': it['percentual_carteira']
                })

       
        soma_valor_dy = 0.0
        for it in itens:
            dy_raw = it.get('dy')
            if dy_raw is None:
                continue
            try:
                dy_val = float(dy_raw)
            except Exception:
                continue
            dy_frac = (dy_val / 100.0) if dy_val > 1.5 else dy_val
            soma_valor_dy += float((it.get('valor_total') or 0.0)) * dy_frac
        weighted_dy = (soma_valor_dy / total_investido) if total_investido > 0 else None
        weighted_dy_pct = (round(weighted_dy * 100.0, 2) if weighted_dy is not None else None)

    
        def _safe_vals(key):
            vals = [float(it.get(key)) for it in itens if it.get(key) is not None]
            return vals
        vals_pl = _safe_vals('pl')
        vals_pvp = _safe_vals('pvp')
        vals_roe = _safe_vals('roe')

        avg_pl = (sum(vals_pl)/len(vals_pl)) if vals_pl else None
        avg_pvp = (sum(vals_pvp)/len(vals_pvp)) if vals_pvp else None
        avg_roe = (sum(vals_roe)/len(vals_roe)) if vals_roe else None

        high_pl = len([v for v in vals_pl if v is not None and v > 25.0])
        low_pl = len([v for v in vals_pl if v is not None and 0.0 < v <= 10.0])
        undervalued_pvp = len([v for v in vals_pvp if v is not None and v <= 1.0])
        over_pvp = len([v for v in vals_pvp if v is not None and v >= 3.0])
        negative_roe = len([v for v in vals_roe if v is not None and v < 0.0])

       
        top_dy = sorted(
            [it for it in itens if it.get('dy') is not None],
            key=lambda x: x.get('dy') or 0.0,
            reverse=True
        )[:5]
        top_dy = [
            {
                'ticker': it['ticker'],
                'nome_completo': it.get('nome_completo'),
                'dy': float(it.get('dy') or 0.0),
                'dy_pct': (round(float(it.get('dy')), 2) if (it.get('dy') is not None and float(it.get('dy')) > 1.5) else round((float(it.get('dy') or 0.0) * 100.0), 2)),
                'percentual_carteira': next((e['percentual_carteira'] for e in enriched if e['ticker']==it['ticker']), 0.0)
            } for it in top_dy
        ]

  
        shares = [(v / total_investido) for v in tipos_map.values()] if total_investido > 0 else []
        hhi = sum([s*s for s in shares]) if shares else None

        payload = {
            'resumo': {
                'total_investido': total_investido,
                'num_ativos': num_ativos,
                'tipos': {k: {'valor': float(v), 'percentual': (float(v)/total_investido*100.0 if total_investido>0 else 0.0)} for k, v in tipos_map.items()},
                'weighted_dy': weighted_dy,  
                'weighted_dy_pct': weighted_dy_pct,
                'avg_pl': avg_pl,
                'avg_pvp': avg_pvp,
                'avg_roe': avg_roe,  
                'hhi': hhi,
            },
            'concentracao': {
                'top_positions': [
                    {
                        'ticker': it.get('ticker'),
                        'valor_total': float(it.get('valor_total') or 0.0),
                        'percentual': it.get('percentual_carteira')
                    } for it in top_positions
                ],
                'alerts': concentration_alerts
            },
            'avaliacao': {
                'pl': {
                    'avg': avg_pl,
                    'high_count': high_pl,
                    'low_count': low_pl,
                },
                'pvp': {
                    'avg': avg_pvp,
                    'undervalued_count': undervalued_pvp,
                    'overpriced_count': over_pvp,
                },
                'roe': {
                    'avg': avg_roe,
                    'negative_count': negative_roe,
                }
            },
            'renda': {
                'weighted_dy': weighted_dy,
                'weighted_dy_pct': weighted_dy_pct,
                'top_dy': top_dy,
                'ativos_sem_dy': len([1 for it in itens if not it.get('dy')])
            }
        }

        if cache:
            try:
                cache.set(cache_key, payload, timeout=900)  # 15 minutos
            except Exception:
                pass
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/goals', methods=['GET', 'POST'])
def api_goals():
    try:
        usuario_atual = get_usuario_atual()
        if not usuario_atual:
            return jsonify({"error": "Não autenticado"}), 401
        _ensure_goals_schema()
        if request.method == 'GET':
            g = get_goals() or {}
            return jsonify(g)
        data = request.get_json() or {}
        res = save_goals(data)
        try:
            if cache:
                cache.delete(f"goals:{usuario_atual}")
        except Exception:
            pass
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/goals/projecao', methods=['POST'])
def api_goals_projecao():
    try:
        usuario_atual = get_usuario_atual()
        if not usuario_atual:
            return jsonify({"error": "Não autenticado"}), 401
        payload = request.get_json() or {}
        goal = payload or (get_goals() or {})
        proj = compute_goals_projection(goal or {})
        return jsonify(proj)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== EXPORT RELATÓRIOS ====================

def _parse_periodo_args():
    mes = request.args.get('mes')
    ano = request.args.get('ano')
    inicio = request.args.get('inicio')
    fim = request.args.get('fim')
    return mes, ano, inicio, fim


@server.route('/api/relatorios/movimentacoes.csv', methods=['GET'])
def export_movimentacoes_csv():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        mes, ano, inicio, fim = _parse_periodo_args()
        if inicio or fim:
            movs = obter_movimentacoes() or []
            def to_date(s):
                from datetime import datetime
                try:
                    return datetime.strptime(s[:10], '%Y-%m-%d')
                except Exception:
                    return None
            di = to_date(inicio) if inicio else None
            df = to_date(fim) if fim else None
            filtered = []
            for m in movs:
                dt = to_date(m.get('data') or '')
                if dt is None:
                    continue
                if di and dt < di:
                    continue
                if df and dt > df:
                    continue
                filtered.append(m)
            rows = filtered
        else:
            rows = obter_movimentacoes(mes, ano) or []

        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['data', 'ticker', 'nome', 'quantidade', 'preco', 'tipo'])
        for r in rows:
            writer.writerow([
                r.get('data'), r.get('ticker'), r.get('nome_completo'), r.get('quantidade'), r.get('preco'), r.get('tipo')
            ])
        resp = make_response(output.getvalue())
        resp.headers['Content-Type'] = 'text/csv; charset=utf-8'
        resp.headers['Content-Disposition'] = 'attachment; filename="movimentacoes.csv"'
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/relatorios/posicoes.csv', methods=['GET'])
def export_posicoes_csv():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        itens = obter_carteira() or []
        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ticker', 'nome', 'quantidade', 'preco_atual', 'valor_total', 'tipo', 'dy', 'pl', 'pvp', 'roe'])
        for it in itens:
            writer.writerow([
                it.get('ticker'), it.get('nome_completo'), it.get('quantidade'), it.get('preco_atual'),
                it.get('valor_total'), it.get('tipo'), it.get('dy'), it.get('pl'), it.get('pvp'), it.get('roe')
            ])
        resp = make_response(output.getvalue())
        resp.headers['Content-Type'] = 'text/csv; charset=utf-8'
        resp.headers['Content-Disposition'] = 'attachment; filename="posicoes.csv"'
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/relatorios/rendimentos.csv', methods=['GET'])
def export_rendimentos_csv():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        periodo = request.args.get('periodo', 'mensal')
        hist = obter_historico_carteira_comparado(periodo or 'mensal') or {}
        datas = hist.get('datas') or []
        carteira = hist.get('carteira_valor') or []
        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['periodo', 'valor_carteira'])
        for i, d in enumerate(datas):
            writer.writerow([d, carteira[i] if i < len(carteira) else None])
        resp = make_response(output.getvalue())
        resp.headers['Content-Type'] = 'text/csv; charset=utf-8'
        resp.headers['Content-Disposition'] = 'attachment; filename="rendimentos.csv"'
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/relatorios/movimentacoes.pdf', methods=['GET'])
def export_movimentacoes_pdf():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        mes, ano, inicio, fim = _parse_periodo_args()
        if inicio or fim:
            rows = obter_movimentacoes() or []
        else:
            rows = obter_movimentacoes(mes, ano) or []
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            from io import BytesIO
        except Exception:
            return jsonify({"error": "PDF indisponível no momento (dependência ausente)"}), 500
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 40
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, "Relatório de Movimentações")
        y -= 20
        c.setFont("Helvetica", 9)
        for r in rows:
            if y < 40:
                c.showPage(); y = height - 40; c.setFont("Helvetica", 9)
            line = f"{r.get('data','')}  {r.get('ticker',''):8}  {r.get('tipo',''):7}  qtd={r.get('quantidade','')}  preco={r.get('preco','')}"
            c.drawString(40, y, line)
            y -= 14
        c.showPage()
        c.save()
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name='movimentacoes.pdf', mimetype='application/pdf')
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/relatorios/posicoes.pdf', methods=['GET'])
def export_posicoes_pdf():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        itens = obter_carteira() or []
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            from io import BytesIO
        except Exception:
            return jsonify({"error": "PDF indisponível no momento (dependência ausente)"}), 500
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 40
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, "Relatório de Posições")
        y -= 20
        c.setFont("Helvetica", 9)
        for it in itens:
            if y < 40:
                c.showPage(); y = height - 40; c.setFont("Helvetica", 9)
            line = f"{it.get('ticker',''):8}  {it.get('nome_completo','')[:40]}  qtd={it.get('quantidade','')}  val={it.get('valor_total','')}"
            c.drawString(40, y, line)
            y -= 14
        c.showPage()
        c.save()
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name='posicoes.pdf', mimetype='application/pdf')
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route('/api/relatorios/rendimentos.pdf', methods=['GET'])
def export_rendimentos_pdf():
    try:
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        periodo = request.args.get('periodo', 'mensal')
        hist = obter_historico_carteira_comparado(periodo or 'mensal') or {}
        datas = hist.get('datas') or []
        carteira = hist.get('carteira_valor') or []
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            from io import BytesIO
        except Exception:
            return jsonify({"error": "PDF indisponível no momento (dependência ausente)"}), 500
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 40
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, "Relatório de Rendimentos")
        y -= 20
        c.setFont("Helvetica", 9)
        for i, d in enumerate(datas):
            if y < 40:
                c.showPage(); y = height - 40; c.setFont("Helvetica", 9)
            val = carteira[i] if i < len(carteira) else None
            line = f"{d}: {val}"
            c.drawString(40, y, line)
            y -= 14
        c.showPage()
        c.save()
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name='rendimentos.pdf', mimetype='application/pdf')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Rotas sem extensão para evitar conflitos com estáticos
@server.route('/api/relatorios/movimentacoes', methods=['GET'])
def export_movimentacoes_generic():
    formato = (request.args.get('formato') or 'csv').lower()
    if formato == 'pdf':
        return export_movimentacoes_pdf()
    return export_movimentacoes_csv()

@server.route('/api/relatorios/posicoes', methods=['GET'])
def export_posicoes_generic():
    formato = (request.args.get('formato') or 'csv').lower()
    if formato == 'pdf':
        return export_posicoes_pdf()
    return export_posicoes_csv()

@server.route('/api/relatorios/rendimentos', methods=['GET'])
def export_rendimentos_generic():
    formato = (request.args.get('formato') or 'csv').lower()
    if formato == 'pdf':
        return export_rendimentos_pdf()
    return export_rendimentos_csv()

@server.route("/api/carteira/adicionar", methods=["POST"])
def api_adicionar_ativo():
    """API para adicionar um ativo à carteira"""
    try:
        data = request.get_json()
        ticker = data.get('ticker')
        quantidade = data.get('quantidade')
        tipo = data.get('tipo')
        preco_inicial = data.get('preco_inicial')
        nome_personalizado = data.get('nome_personalizado')
        indexador = data.get('indexador')  # 'CDI' | 'IPCA' | 'SELIC' | 'PREFIXADO' | None
        indexador_pct = data.get('indexador_pct')  # percentual (ex.: 110) ou taxa fixa (% a.a.)
        data_aplicacao = data.get('data_aplicacao')  # 'YYYY-MM-DD'
        vencimento = data.get('vencimento')  # 'YYYY-MM-DD'
        isento_ir = data.get('isento_ir')  # bool
        liquidez_diaria = data.get('liquidez_diaria')  # bool
        sobrescrever = data.get('sobrescrever', False)  # bool - para sobrescrever ativo existente
        
        if not ticker or not quantidade:
            return jsonify({"error": "Ticker e quantidade são obrigatórios"}), 400

        # Estimar preço histórico para RV quando data_aplicacao informada e sem preco
        try:
            tipo_lc = (tipo or '').strip().lower()
            is_rv = any(k in tipo_lc for k in ['ação','acoes','acao','fii','bdr'])
            if (preco_inicial is None or preco_inicial == '' or float(preco_inicial) == 0.0) and data_aplicacao and is_rv and not indexador:
                t = (ticker or '').strip().upper()
                t_yf = t + '.SA' if ('-' not in t and '.' not in t and len(t) <= 6) else t
                from datetime import datetime, timedelta
                try:
                    base_date = datetime.strptime(str(data_aplicacao)[:10], '%Y-%m-%d').date()
                except Exception:
                    base_date = datetime.utcnow().date()
                start = base_date - timedelta(days=14)
                end = base_date + timedelta(days=1)
                try:
                    hist = yf.Ticker(t_yf).history(start=start.isoformat(), end=end.isoformat())
                    if hist is not None and not hist.empty:
                        close_val = None
                        for idx, row in hist[::-1].iterrows():
                            d = idx.date()
                            if d <= base_date:
                                close_val = float(row.get('Close') or row.get('Adj Close') or 0)
                                break
                        if close_val and close_val > 0:
                            preco_inicial = close_val
                except Exception:
                    pass
        except Exception:
            pass

        resultado = adicionar_ativo_carteira(
            ticker, quantidade, tipo, preco_inicial, nome_personalizado,
            indexador, indexador_pct, data_aplicacao, vencimento, isento_ir, liquidez_diaria, sobrescrever
        )
        # invalidar cache simples
        try:
            if cache:
                cache.clear()
        except Exception:
            pass
        if resultado["success"]:
            return jsonify(resultado), 201
        else:
            return jsonify(resultado), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/remover/<int:id>", methods=["DELETE"])
def api_remover_ativo(id):
    """API para remover um ativo da carteira"""
    try:
        resultado = remover_ativo_carteira(id)
        try:
            if cache:
                cache.clear()
        except Exception:
            pass
        
        if resultado["success"]:
            return jsonify(resultado), 200
        else:
            return jsonify(resultado), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/atualizar/<int:id>", methods=["PUT"])
def api_atualizar_ativo(id):
    """API para atualizar quantidade e/ou preço do ativo"""
    try:
        data = request.get_json() or {}
        quantidade = data.get('quantidade')
        preco_atual = data.get('preco_atual')
        preco_compra = data.get('preco_compra')
        if quantidade is None and preco_atual is None and preco_compra is None:
            return jsonify({"error": "Informe quantidade, preco_atual e/ou preco_compra"}), 400
        resultado = atualizar_ativo_carteira(id, quantidade, preco_atual, preco_compra)
        try:
            if cache:
                cache.clear()
        except Exception:
            pass
        
        if resultado["success"]:
            return jsonify(resultado), 200
        else:
            return jsonify(resultado), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/movimentacoes", methods=["GET"])
def api_get_movimentacoes():

    try:
        mes = request.args.get('mes', type=int)
        ano = request.args.get('ano', type=int)
        
        usuario_atual = get_usuario_atual()
        cache_key = None
        if cache and usuario_atual:
            cache_key = f"movimentacoes:{usuario_atual}:{mes or ''}:{ano or ''}"
            cached = cache.get(cache_key)
            if cached is not None:
                return jsonify(cached)
        movimentacoes = obter_movimentacoes(mes, ano)
        if cache and cache_key:
            try:
                cache.set(cache_key, movimentacoes, timeout=600)  # 10 minutos
            except Exception:
                pass
        return jsonify(movimentacoes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/rebalance/config", methods=["GET", "POST"])
def api_rebalance_config():
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            periodo = str(data.get('periodo') or 'mensal').lower()
            targets = data.get('targets') or {}
            last_rebalance_date = data.get('last_rebalance_date')
            res = save_rebalance_config(periodo, targets, last_rebalance_date)
            return jsonify(res)
        else:
            cfg = get_rebalance_config() or {}
            return jsonify(cfg)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/rebalance/status", methods=["GET"])
def api_rebalance_status():
    try:
        status = compute_rebalance_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/rebalance/history", methods=["GET", "POST"])
def api_rebalance_history():
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            date_str = data.get('date')
            res = registrar_rebalance_event(date_str)
            return jsonify(res)
        else:
            hist = get_rebalance_history() or []
            return jsonify({"history": hist})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Indicadores (SELIC, CDI, IPCA) via BCB SGS
@server.route("/api/indicadores", methods=["GET"])
def api_indicadores():
    try:

        def sgs_last(series_id, use_range=False):
            if use_range:
                end_date = datetime.now()
                start_date = end_date - timedelta(days=90)
                url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados?"
                       f"formato=json&dataInicial={start_date.strftime('%d/%m/%Y')}"
                       f"&dataFinal={end_date.strftime('%d/%m/%Y')}")
                r = requests.get(url, timeout=10)
                r.raise_for_status()
                arr = r.json()
                return arr[-1] if arr else None
            else:
                url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados/ultimos/1?formato=json"
                r = requests.get(url, timeout=10)
                r.raise_for_status()
                arr = r.json()
                return arr[0] if arr else None

        selic = sgs_last(432, use_range=True)
        cdi = sgs_last(12, use_range=True)
        ipca = sgs_last(433)
        
        return jsonify({
            "selic": selic,
            "cdi": cdi,
            "ipca": ipca,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Taxas de indexadores (SELIC, CDI, IPCA) via função do models.py
@server.route("/api/taxas-indexadores", methods=["GET"])
def api_taxas_indexadores():
    try:
        taxas = obter_taxas_indexadores()
        
        return jsonify({
            "selic": taxas.get('SELIC', 0),
            "cdi": taxas.get('CDI', 0),
            "ipca": taxas.get('IPCA', 0),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Erro ao obter taxas de indexadores: {e}")
        return jsonify({"error": str(e)}), 500

@server.route("/api/tesouro/titulos", methods=["GET"])
def api_tesouro_titulos():
    try:
        # Cache curto para evitar excesso de chamadas
        try:
            if cache:
                cached = cache.get("tesouro_titulos")
                if cached is not None:
                    return jsonify(cached)
        except Exception:
            pass

        url = "https://www.tesourodireto.com.br/json/consulta/PrecoTaxaTitulo.json"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.tesourodireto.com.br/",
        }
        r = requests.get(url, timeout=15, headers=headers)
        r.raise_for_status()
        try:
            data = r.json()
        except Exception:
            
            r2 = requests.get(url + f"?cb={int(datetime.now().timestamp())}", timeout=15, headers=headers)
            r2.raise_for_status()
            data = r2.json()

        # Se vier vazio, tentar cloudscraper (bypass de proteção)
        if (not data or not data.get('response')) and cloudscraper is not None:
            scraper = cloudscraper.create_scraper()
            resp = scraper.get(url, timeout=20, headers=headers)
            try:
                data = resp.json()
            except Exception:
                pass

        def _norm_index(idx: str | None) -> str | None:
            if not idx:
                return None
            s = str(idx).lower()
            if 'selic' in s:
                return 'SELIC'
            if 'ipca' in s:
                return 'IPCA'
            if 'prefix' in s or 'pre' in s:
                return 'PREFIXADO'
            return idx

        def _familia(type_str: str | None, nome: str | None) -> str | None:
            ts = (type_str or '').upper()
            if ts in ('LFT', 'LTN', 'NTN-B', 'NTN-F'):
                return ts
            nome_s = (nome or '').upper()
            if 'SELIC' in nome_s:
                return 'LFT'
            if 'PREFIX' in nome_s:
                return 'LTN' if 'SEMET' not in nome_s else 'NTN-F'
            if 'IPCA' in nome_s and 'SEMEST' in nome_s:
                return 'NTN-B'
            if 'IPCA' in nome_s:
                return 'NTN-B PRINCIPAL'
            return type_str

        def _cupom(type_str: str | None, nome: str | None) -> bool:
            ts = (type_str or '').upper()
            if ts in ('NTN-B', 'NTN-F'):
                return True
            nome_s = (nome or '').upper()
            return ('SEMEST' in nome_s) or ('JUROS' in nome_s)

        from datetime import datetime as _dt

        titulos = []
        updated_at = _dt.now().isoformat()
        for grupo in (data.get('response', {}).get('TrsrBondMkt', []) or []):
            for t in (grupo.get('TrsrBd', []) or []):
                nome = t.get('bond')
                venc = t.get('maturityDate')
                idx_raw = t.get('index')
                type_raw = t.get('type')
                taxa_compra = t.get('invstRate')
                taxa_resgate = t.get('invstRedRate') if 'invstRedRate' in t else t.get('redRate')
                pu = t.get('unitPrice') if 'unitPrice' in t else t.get('minInvstAmt')
                min_invest = t.get('minInvstAmt')

                # Heurística de disponibilidade
                disponivel_compra = taxa_compra is not None and min_invest is not None
                disponivel_resgate = taxa_resgate is not None

                # Prazo até vencimento (dias)
                prazo_dias = None
                try:
                    if venc:
                        # remover timezone se vier com 'Z'
                        v = str(venc).replace('Z', '')
                        dt_venc = _dt.fromisoformat(v)
                        prazo_dias = (dt_venc.date() - _dt.now().date()).days
                except Exception:
                    prazo_dias = None

                item = {
                    # Campos existentes para compatibilidade
                    "nome": nome,
                    "vencimento": venc,
                    "taxaCompra": taxa_compra,
                    "pu": pu,
                    "indexador": idx_raw,
                    "tipoRent": type_raw,
                    # Campos novos/normalizados
                    "indexador_normalizado": _norm_index(idx_raw),
                    "familia_td": _familia(type_raw, nome),
                    "cupom_semestral": _cupom(type_raw, nome),
                    "taxa_compra_aa": taxa_compra,
                    "taxa_resgate_aa": taxa_resgate,
                    "min_invest": min_invest,
                    "disponivel_compra": disponivel_compra,
                    "disponivel_resgate": disponivel_resgate,
                    "prazo_dias": prazo_dias,
                    "updated_at": updated_at,
                }
                titulos.append(item)

        payload = {"titulos": titulos}
        try:
            if cache:
                cache.set("tesouro_titulos", payload, timeout=60)
        except Exception:
            pass
        return jsonify(payload)
    except Exception as e:
        try:
            print(f"TESOURO ERROR: {e}")
        except Exception:
            pass
       
        return jsonify({"titulos": [], "fallback": True, "error": str(e)}), 200

# ==================== NOVA API TESOURO DIRETO COM BIBLIOTECA ====================

@server.route("/api/tesouro-direto/titulos", methods=["GET"])
def api_tesouro_direto_titulos():
    """
    Nova API para títulos do Tesouro Direto usando tesouro-direto-br
    """
    try:
        # Cache para evitar chamadas excessivas
        try:
            if cache:
                cached = cache.get("tesouro_direto_titulos")
                if cached is not None:
                    return jsonify(cached)
        except Exception:
            pass

        # Importar e usar a nova API
        from tesouro_direto_api import obter_titulos_tesouro_direto
        
        resultado = obter_titulos_tesouro_direto()
        
        # Cache por 1 hora (dados são atualizados apenas em dias úteis)
        try:
            if cache:
                cache.set("tesouro_direto_titulos", resultado, timeout=3600)
        except Exception:
            pass
            
        return jsonify(resultado)
        
    except Exception as e:
        print(f"ERRO na API tesouro-direto: {e}")
        return jsonify({
            "titulos": [],
            "total": 0,
            "data_referencia": datetime.now().strftime('%Y-%m-%d'),
            "categorias": [],
            "indexadores": [],
            "erro": str(e)
        }), 500

@server.route("/api/tesouro-direto/ettj", methods=["GET"])
def api_tesouro_direto_ettj():
    """
    API para ETTJ do Tesouro Direto
    """
    try:
        from tesouro_direto_api import obter_ettj_atual
        resultado = obter_ettj_atual()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/tesouro-direto/movimentacoes", methods=["GET"])
def api_tesouro_direto_movimentacoes():
    """
    API para movimentações do Tesouro Direto
    """
    try:
        tipo = request.args.get('tipo', 'venda')
        from tesouro_direto_api import obter_movimentacoes_tesouro
        resultado = obter_movimentacoes_tesouro(tipo)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/carteira/tipos", methods=["GET", "POST", "PUT", "DELETE"])
def api_asset_types():
    try:
        if request.method == 'GET':
            return jsonify({"tipos": list_asset_types()})
        data = request.get_json() or {}
        if request.method == 'POST':
            nome = str(data.get('nome') or '').strip()
            res = create_asset_type(nome)
            return jsonify(res)
        if request.method == 'PUT':
            old = str(data.get('old') or '').strip()
            new = str(data.get('new') or '').strip()
            res = rename_asset_type(old, new)
            return jsonify(res)
        if request.method == 'DELETE':
            nome = str(data.get('nome') or '').strip()
            res = delete_asset_type(nome)
            return jsonify(res)
        return jsonify({"error": "Método não suportado"}), 405
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/historico", methods=["GET"])
def api_get_historico_carteira():

    try:
        agregacao = request.args.get('periodo', 'mensal')  
        print(f"DEBUG: API /api/carteira/historico chamada com agregacao: {agregacao}")
        dados = obter_historico_carteira_comparado(agregacao)
        return jsonify(dados)
    except Exception as e:
        print(f"DEBUG: Erro na API: {e}")
        return jsonify({"error": str(e)}), 500

@server.route("/api/carteira/proventos", methods=["POST"])
def api_get_proventos():

    try:
        data = request.get_json()
        tickers = data.get('tickers', [])
        periodo = data.get('periodo', 'total')  
        
        if not tickers:
            return jsonify([])
        
        resultado = []
        

        data_inicio = None
        if periodo != 'total':
            hoje = datetime.now()
            if periodo == 'mes':
                data_inicio = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '6meses':
                data_inicio = hoje - timedelta(days=180)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '1ano':
                data_inicio = hoje - timedelta(days=365)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '5anos':
                data_inicio = hoje - timedelta(days=365*5)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Paralelização: busca proventos de todos os tickers simultaneamente
        def _buscar_proventos_ticker(ticker):
            """Função auxiliar para buscar proventos de um ticker"""
            try:
                if not ticker.endswith('.SA') and not '.' in ticker:
                    ticker_normalizado = f"{ticker}.SA"
                else:
                    ticker_normalizado = ticker

                ativo = yf.Ticker(ticker_normalizado)
                dividendos = ativo.dividends
                
                if dividendos is not None and not dividendos.empty:
                    proventos = []
                    for data, valor in dividendos.items():
                        data_sem_timezone = data.replace(tzinfo=None)

                        if data_inicio is None or data_sem_timezone >= data_inicio:
                            proventos.append({
                                'data': data.strftime('%Y-%m-%d'),
                                'valor': float(valor),
                                'tipo': 'Dividendo'
                            })

                    info = ativo.info
                    nome = info.get('longName', ticker_normalizado)
                    
                    return {
                        'ticker': ticker,
                        'nome': nome,
                        'proventos': proventos
                    }
                else:
                    return {
                        'ticker': ticker,
                        'nome': ticker,
                        'proventos': [],
                        'erro': 'Nenhum provento encontrado'
                    }
            except Exception as e:
                return {
                    'ticker': ticker,
                    'nome': ticker,
                    'proventos': [],
                    'erro': f'Erro ao buscar dados: {str(e)}'
                }
        
        # OTIMIZAÇÃO: Reduzido de 10 para 5 workers para evitar sobrecarga de RAM no Render
        max_workers = min(len(tickers), 200)  # Até 200 workers simultâneos
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submete todas as tarefas
            future_to_ticker = {
                executor.submit(_buscar_proventos_ticker, ticker): ticker 
                for ticker in tickers
            }
            
            # Coleta resultados conforme terminam
            for future in as_completed(future_to_ticker):
                try:
                    resultado_ativo = future.result()
                    resultado.append(resultado_ativo)
                except Exception as e:
                    ticker = future_to_ticker[future]
                    resultado.append({
                        'ticker': ticker,
                        'nome': ticker,
                        'proventos': [],
                        'erro': f'Erro ao processar: {str(e)}'
                    })
        
        return jsonify(resultado)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _buscar_proventos_ativo(ativo, data_inicio):
    """
    Função auxiliar para buscar proventos de um ativo.
    Usada para paralelização no endpoint /api/carteira/proventos-recebidos.
    """
    try:
        ticker = ativo['ticker']
        quantidade = ativo['quantidade']
        data_aquisicao = ativo.get('data_adicao')
        
        if not ticker.endswith('.SA') and not '.' in ticker:
            ticker_normalizado = f"{ticker}.SA"
        else:
            ticker_normalizado = ticker
        
        ativo_yf = yf.Ticker(ticker_normalizado)
        dividendos = ativo_yf.dividends
        
        if dividendos is not None and not dividendos.empty:
            proventos_recebidos = []
            for data, valor in dividendos.items():
                # Converter para datetime sem timezone para comparação
                data_sem_timezone = data.replace(tzinfo=None)
                
                # Só considerar dividendos pagos após a data de aquisição
                if data_aquisicao:
                    try:
                        data_aquisicao_dt = datetime.strptime(data_aquisicao, '%Y-%m-%d %H:%M:%S')
                        if data_sem_timezone < data_aquisicao_dt:
                            continue  # Pular dividendos pagos antes da aquisição
                    except ValueError:
                        # Se não conseguir fazer o parse, tentar só a data
                        try:
                            data_aquisicao_dt = datetime.strptime(data_aquisicao, '%Y-%m-%d')
                            if data_sem_timezone < data_aquisicao_dt:
                                continue  # Pular dividendos pagos antes da aquisição
                        except ValueError:
                            # Se ainda não conseguir, ignorar a data de aquisição
                            pass
                
                if data_inicio is None or data_sem_timezone >= data_inicio:
                    valor_recebido = float(valor) * quantidade
                    proventos_recebidos.append({
                        'data': data.strftime('%Y-%m-%d'),
                        'valor_unitario': float(valor),
                        'quantidade': quantidade,
                        'valor_recebido': valor_recebido,
                        'tipo': 'Dividendo'
                    })
            
            if proventos_recebidos:
                info = ativo_yf.info
                nome = info.get('longName', ticker_normalizado)
                
                return {
                    'ticker': ticker,
                    'nome': nome,
                    'quantidade_carteira': quantidade,
                    'data_aquisicao': data_aquisicao,
                    'proventos_recebidos': proventos_recebidos,
                    'total_recebido': sum(p['valor_recebido'] for p in proventos_recebidos)
                }
        
        return None
    except Exception as e:
        print(f"Erro ao processar proventos para {ativo.get('ticker', 'desconhecido')}: {str(e)}")
        return None

@server.route("/api/carteira/proventos-recebidos", methods=["GET"])
def api_get_proventos_recebidos():
    """API para obter proventos recebidos baseado na carteira do usuário"""
    try:
        periodo = request.args.get('periodo', 'total')
        
        # Obter carteira do usuário
        carteira = obter_carteira()
        if not carteira:
            return jsonify([])
        
        # Calcular data de início baseada no período
        data_inicio = None
        if periodo != 'total':
            hoje = datetime.now()
            if periodo == 'mes':
                data_inicio = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '6meses':
                data_inicio = hoje - timedelta(days=180)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '1ano':
                data_inicio = hoje - timedelta(days=365)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
            elif periodo == '5anos':
                data_inicio = hoje - timedelta(days=365*5)
                data_inicio = data_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Paralelização: busca proventos de todos os ativos simultaneamente
        resultado = []
        # OTIMIZAÇÃO: Reduzido de 10 para 5 workers para evitar sobrecarga de RAM no Render
        max_workers = min(len(carteira), 5)  # Limitar a 5 workers (reduz uso de RAM ~50%)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submete todas as tarefas
            future_to_ativo = {
                executor.submit(_buscar_proventos_ativo, ativo, data_inicio): ativo 
                for ativo in carteira
            }
            
            # Coleta resultados conforme terminam
            for future in as_completed(future_to_ativo):
                try:
                    resultado_ativo = future.result()
                    if resultado_ativo is not None:
                        resultado.append(resultado_ativo)
                except Exception as e:
                    ativo = future_to_ativo[future]
                    print(f"Erro ao processar proventos para {ativo.get('ticker', 'desconhecido')}: {str(e)}")
                    continue
        
        return jsonify(resultado)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== MARMITAS API ====================

@server.route("/api/marmitas", methods=["GET"])
def api_get_marmitas():
  
    try:
        mes = request.args.get('mes', type=int)
        ano = request.args.get('ano', type=int)
        
        usuario = get_usuario_atual()
        mes_key = str(mes).zfill(2) if mes else ''
        ano_key = str(ano) if ano else ''
        
        # Log para debug em produção
        print(f"DEBUG MARMITAS: usuario={usuario}, mes={mes}, ano={ano}, mes_key='{mes_key}', ano_key='{ano_key}'")
        
        cache_key = None
        if cache and usuario:
            cache_key = f"marmitas:{usuario}:{mes_key}:{ano_key}"
            cached = cache.get(cache_key)
            if cached is not None:
                print(f"DEBUG MARMITAS: Cache hit para {cache_key}")
                registros = cached
            else:
                print(f"DEBUG MARMITAS: Cache miss, consultando banco")
                registros = consultar_marmitas(mes_key or None, ano_key or None)
        else:
            print(f"DEBUG MARMITAS: Sem cache, consultando banco diretamente")
            registros = consultar_marmitas(mes_key or None, ano_key or None)
        

        print(f"DEBUG MARMITAS: {len(registros)} registros encontrados")
        
        marmitas = []
        for registro in registros:
            # Formatação mais robusta da data
            data_str = str(registro[1])
            if len(data_str) >= 10:
                data_formatada = data_str[:10]
            else:
                data_formatada = data_str
            
            marmita = {
                'id': registro[0],
                'data': data_formatada,
                'valor': float(registro[2]) if registro[2] is not None else 0,
                'comprou': bool(registro[3])
            }
            marmitas.append(marmita)
            print(f"DEBUG MARMITAS: Processando {marmita}")
        
        print(f"DEBUG MARMITAS: Retornando {len(marmitas)} marmitas")
        
        if cache and cache_key:
            try:
                cache.set(cache_key, registros, timeout=30)
            except Exception:
                pass
        return jsonify(marmitas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/marmitas", methods=["POST"])
def api_adicionar_marmita():

    try:
        data = request.get_json()
        data_marmita = data.get('data')
        valor = data.get('valor', 0)
        comprou = data.get('comprou', True)
        
        print(f"DEBUG ADICIONAR MARMITA: data={data_marmita}, valor={valor}, comprou={comprou}")
        
        if not data_marmita:
            return jsonify({"error": "Data é obrigatória"}), 400
            

        data_limpa = str(data_marmita)[:10]
        print(f"DEBUG ADICIONAR MARMITA: data_limpa={data_limpa}")
        
        adicionar_marmita(data_limpa, valor, 1 if comprou else 0)
        print(f"DEBUG ADICIONAR MARMITA: Marmita adicionada com sucesso")
        
        # Invalidar cache específico de marmitas
        try:
            if cache:
                usuario = get_usuario_atual()
                if usuario:
                    # Invalidar cache de marmitas para o usuário
                    cache.delete_memoized(lambda: None, f"marmitas:{usuario}")
                    # Também limpar cache geral
                    cache.clear()
        except Exception:
            pass
        
        return jsonify({"success": True, "message": "Marmita adicionada com sucesso"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/marmitas/<int:id>", methods=["PUT"])
def api_atualizar_marmita(id):
    
    try:
        data = request.get_json()
        data_marmita = data.get('data')
        valor = data.get('valor')
        comprou = data.get('comprou')
        
        resultado = atualizar_marmita(id, data_marmita, valor, comprou)
        if resultado.get('success'):
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"success": True, "message": "Marmita atualizada com sucesso"}), 200
        else:
            return jsonify({"error": resultado.get('message', 'Erro ao atualizar marmita')}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/marmitas/<int:id>", methods=["DELETE"])
def api_remover_marmita(id):
    
    try:
        remover_marmita(id)
        try:
            if cache:
                cache.clear()
        except Exception:
            pass
        return jsonify({"success": True, "message": "Marmita removida com sucesso"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route("/api/marmitas/gastos-mensais", methods=["GET"])
def api_get_gastos_mensais():

    try:
        periodo = request.args.get('periodo', '6m')
        
        usuario = get_usuario_atual()
        cache_key = None
        if cache and usuario:
            cache_key = f"marmitas_gastos:{usuario}:{periodo}"
            cached = cache.get(cache_key)
            if cached is not None:
                return jsonify(cached)
        df_gastos = gastos_mensais(periodo)
        
        gastos = []
        for _, row in df_gastos.iterrows():
            gastos.append({
                'mes': row['AnoMes'],
                'valor': float(row['valor'])
            })
        
        if cache and cache_key:
            try:
                cache.set(cache_key, gastos, timeout=30)
            except Exception:
                pass
        return jsonify(gastos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== APIs DE CONTROLE FINANCEIRO ====================

@server.route("/api/controle/receitas", methods=["GET", "POST", "PUT", "DELETE"])
def api_receitas():

    try:
        if request.method == "POST":
            data = request.get_json()
            nome = data.get('nome')
            valor = data.get('valor')
            if valor and nome:
                try:
                    _upgrade_controle_schema()
                except Exception:
                    pass
                res = salvar_receita(
                    nome, valor,
                    data=data.get('data'),
                    categoria=data.get('categoria'),
                    tipo=data.get('tipo'),
                    recorrencia=data.get('recorrencia'),
                    parcelas_total=data.get('parcelas_total'),
                    parcela_atual=data.get('parcela_atual'),
                    grupo_parcela=data.get('grupo_parcela'),
                    observacao=data.get('observacao')
                )
                if isinstance(res, dict) and not res.get('success', True):
                    return jsonify(res), 401
                try:
                    if cache:
                        cache.clear()
                except Exception:
                    pass
                return jsonify({"message": "Receita salva com sucesso"})
            return jsonify({"error": "Nome e valor são obrigatórios"}), 400
        elif request.method == "PUT":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            atualizar_receita(
                data.get('id'),
                nome=data.get('nome'),
                valor=data.get('valor'),
                data=data.get('data'),
                categoria=data.get('categoria'),
                tipo=data.get('tipo'),
                recorrencia=data.get('recorrencia'),
                parcelas_total=data.get('parcelas_total'),
                parcela_atual=data.get('parcela_atual'),
                grupo_parcela=data.get('grupo_parcela'),
                observacao=data.get('observacao')
            )
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Receita atualizada com sucesso"})
        elif request.method == "DELETE":
            id_registro = request.args.get('id', type=int)
            if id_registro:
                remover_receita(id_registro)
                try:
                    if cache:
                        cache.clear()
                except Exception:
                    pass
                return jsonify({"message": "Receita removida com sucesso"})
            return jsonify({"error": "ID é obrigatório"}), 400
        else:
            mes = request.args.get('mes', type=str)
            ano = request.args.get('ano', type=str)
            usuario = get_usuario_atual()
            cache_key = None
            if cache and usuario:
                cache_key = f"receitas:{usuario}:{mes or ''}:{ano or ''}"
                cached = cache.get(cache_key)
                if cached is not None:
                    return jsonify(cached)
            receitas = carregar_receitas_mes_ano(mes, ano)
            payload = receitas.to_dict('records') if not receitas.empty else []
            if cache and cache_key:
                try:
                    cache.set(cache_key, payload, timeout=30)
                except Exception:
                    pass
            return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route("/api/controle/cartoes", methods=["GET", "POST", "PUT", "DELETE"])
def api_cartoes():
    
    return jsonify({"error": "Rota removida - use /api/controle/cartoes-cadastrados"}), 410

@server.route("/api/controle/outros", methods=["GET", "POST", "PUT", "DELETE"])
def api_outros():

    try:
        if request.method == "POST":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = adicionar_outro_gasto(
                data.get('nome'), data.get('valor'),
                data=data.get('data'),
                categoria=data.get('categoria'),
                tipo=data.get('tipo'),
                recorrencia=data.get('recorrencia'),
                parcelas_total=data.get('parcelas_total'),
                parcela_atual=data.get('parcela_atual'),
                grupo_parcela=data.get('grupo_parcela'),
                observacao=data.get('observacao')
            )
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Gasto adicionado com sucesso"})
        elif request.method == "PUT":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            atualizar_outro_gasto(
                data.get('id'), 
                nome=data.get('nome'), 
                valor=data.get('valor'),
                data=data.get('data'),
                categoria=data.get('categoria'),
                tipo=data.get('tipo'),
                recorrencia=data.get('recorrencia'),
                parcelas_total=data.get('parcelas_total'),
                parcela_atual=data.get('parcela_atual'),
                grupo_parcela=data.get('grupo_parcela'),
                observacao=data.get('observacao')
            )
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Gasto atualizado com sucesso"})
        elif request.method == "DELETE":
            id_registro = request.args.get('id', type=int)
            if id_registro:
                remover_outro_gasto(id_registro)
                try:
                    if cache:
                        cache.clear()
                except Exception:
                    pass
                return jsonify({"message": "Gasto removido com sucesso"})
            return jsonify({"error": "ID é obrigatório"}), 400
        else:
            mes = request.args.get('mes', type=str)
            ano = request.args.get('ano', type=str)
            usuario = get_usuario_atual()
            if cache and usuario:
                key = f"outros:{usuario}:{mes or ''}:{ano or ''}"
                cached = cache.get(key)
                if cached is not None:
                    return jsonify(cached)
                outros = carregar_outros_mes_ano(mes, ano)
                try:
                    cache.set(key, outros, timeout=30)
                except Exception:
                    pass
                return jsonify(outros)
            outros = carregar_outros_mes_ano(mes, ano)
            return jsonify(outros)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/saldo", methods=["GET"])
def api_saldo():

    try:
        mes = request.args.get('mes', type=str)
        ano = request.args.get('ano', type=str)
        
        usuario = get_usuario_atual()
        if cache and usuario:
            key = f"saldo:{usuario}:{mes or ''}:{ano or ''}"
            cached = cache.get(key)
            if cached is not None:
                return jsonify({"saldo": cached})
        saldo = calcular_saldo_mes_ano(mes, ano)
        if cache and usuario:
            try:
                cache.set(key, saldo, timeout=30)
            except Exception:
                pass
        return jsonify({"saldo": saldo})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/total-por-pessoa", methods=["GET"])
def api_total_por_pessoa():
   
    try:
        
        return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/evolucao-financeira", methods=["GET"])
def api_evolucao_financeira():
  
    try:
        mes = request.args.get('mes', type=str)
        ano = request.args.get('ano', type=str)
        
        
        df_receita = carregar_receitas_mes_ano(mes, ano)
        df_outros = pd.DataFrame(carregar_outros_mes_ano(mes, ano))
        
    
        if not df_receita.empty:
            df_receita["data"] = pd.to_datetime(df_receita["data"])
            df_receita_grouped = df_receita.groupby("data")["valor"].sum().reset_index(name="receitas")
        else:
            df_receita_grouped = pd.DataFrame(columns=["data", "receitas"])
        
      
        df_outros["data"] = pd.to_datetime(df_outros["data"]) if not df_outros.empty else pd.Series(dtype='datetime64[ns]')
        df_outros_ = df_outros[["data", "valor"]] if not df_outros.empty else pd.DataFrame(columns=["data", "valor"])
        df_despesas = df_outros_ if not df_outros_.empty else pd.DataFrame(columns=["data", "valor"])
        
        if df_despesas.empty:
            df_despesas_grouped = pd.DataFrame({"data": [], "despesas": []})
        else:
            df_despesas_grouped = df_despesas.groupby("data")["valor"].sum().reset_index(name="despesas")
        

        dias = pd.date_range(
            start=f"{ano}-{mes.zfill(2)}-01", 
            end=pd.Timestamp(f"{ano}-{mes.zfill(2)}-01") + pd.offsets.MonthEnd(0)
        )
        df_base = pd.DataFrame({"data": dias})
        
 
        df_merged = pd.merge(df_base, df_receita_grouped, on="data", how="left").merge(df_despesas_grouped, on="data", how="left")
        df_merged["receitas"] = df_merged["receitas"].fillna(0)
        df_merged["despesas"] = df_merged["despesas"].fillna(0)
        df_merged["saldo_dia"] = df_merged["receitas"] - df_merged["despesas"]
        df_merged["saldo_acumulado"] = df_merged["saldo_dia"].cumsum()
        

        evolucao = []
        for _, row in df_merged.iterrows():
            evolucao.append({
                'data': row['data'].strftime('%Y-%m-%d'),
                'receitas': float(row['receitas']),
                'despesas': float(row['despesas']),
                'saldo_dia': float(row['saldo_dia']),
                'saldo_acumulado': float(row['saldo_acumulado'])
            })
        
        return jsonify(evolucao)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/evolucao-receitas", methods=["GET"])
def api_evolucao_receitas():
    try:
        periodo = request.args.get('periodo', '6m')
        
       
        if periodo == '3m':
            meses = 3
        elif periodo == '6m':
            meses = 6
        elif periodo == '12m':
            meses = 12
        else:
            meses = 6
        
      
        hoje = datetime.now()
        evolucao = []
        
        for i in range(meses):

            data_mes = hoje - timedelta(days=30 * i)
            mes = data_mes.month
            ano = data_mes.year
            
          
            df_receitas = carregar_receitas_mes_ano(str(mes).zfill(2), str(ano))
            total_receitas = df_receitas['valor'].sum() if not df_receitas.empty else 0
            

            nome_mes = data_mes.strftime('%b/%Y')
            
            evolucao.append({
                "mes": nome_mes,
                "receitas": float(total_receitas)
            })
        
       
        evolucao.reverse()
        
        return jsonify(evolucao)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/receitas-despesas", methods=["GET"])
def api_receitas_despesas():
   
    try:
        mes = request.args.get('mes', type=str)
        ano = request.args.get('ano', type=str)
        
       
        usuario = get_usuario_atual()
        if cache and usuario:
            key = f"receitas_despesas:{usuario}:{mes or ''}:{ano or ''}"
            cached = cache.get(key)
            if cached is not None:
                return jsonify(cached)
        df_receita = carregar_receitas_mes_ano(mes, ano)
        df_outros = pd.DataFrame(carregar_outros_mes_ano(mes, ano))
        
        despesas = 0
        if not df_outros.empty:
            despesas += df_outros["valor"].sum()
        
        total_receita = df_receita["valor"].sum() if not df_receita.empty else 0
        
        payload = {
            "receitas": float(total_receita),
            "despesas": float(despesas)
        }
        if cache and usuario:
            try:
                cache.set(key, payload, timeout=30)
            except Exception:
                pass
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/home/resumo", methods=["GET"])
def api_home_resumo():

    try:
       
        def _cache_key():
            try:
                user = get_usuario_atual() or 'anon'
            except Exception:
                user = 'anon'
            mes_q = request.args.get('mes', type=str) or ''
            ano_q = request.args.get('ano', type=str) or ''
            return f"home_resumo:{user}:{mes_q}:{ano_q}"
        if cache:
            cached_payload = cache.get(_cache_key())
            if cached_payload is not None:
                return jsonify(cached_payload)
        mes = request.args.get('mes', type=str)
        ano = request.args.get('ano', type=str)
       
        usuario = get_usuario_atual()
        if not usuario:
            return jsonify({"error": "Não autenticado"}), 401
        
        if not mes or not ano:
            return jsonify({"error": "Mês e ano são obrigatórios"}), 400
        

        carteira = obter_carteira()
        total_investido = sum(ativo.get('valor_total', 0) for ativo in carteira)
        ativos_por_tipo = {}
        for ativo in carteira:
            tipo = ativo.get('tipo', 'Desconhecido')
            ativos_por_tipo[tipo] = ativos_por_tipo.get(tipo, 0) + ativo.get('valor_total', 0)
        

        df_receitas = carregar_receitas_mes_ano(mes, ano)
        receitas = df_receitas.to_dict('records') if not df_receitas.empty else []
        total_receitas = df_receitas['valor'].sum() if not df_receitas.empty else 0
        
  
    
        total_cartoes = 0
        
   
        outros = carregar_outros_mes_ano(mes, ano)
        total_outros = sum(outro.get('valor', 0) for outro in outros)
        

        marmitas = consultar_marmitas(mes, ano)
        marmitas_formatted = []
        total_marmitas = 0
        for registro in marmitas:
            marmita = {
                'id': registro[0],
                'data': registro[1],
                'valor': float(registro[2]) if registro[2] else 0,
                'comprou': bool(registro[3])
            }
            marmitas_formatted.append(marmita)
            total_marmitas += marmita['valor']
        
     
        saldo = calcular_saldo_mes_ano(mes, ano)
        
  
        df_receita = carregar_receitas_mes_ano(mes, ano)
        df_outros = pd.DataFrame(carregar_outros_mes_ano(mes, ano))
        
       
        if not df_receita.empty:
            df_receita["data"] = pd.to_datetime(df_receita["data"])
            df_receita_grouped = df_receita.groupby("data")["valor"].sum().reset_index(name="receitas")
        else:
            df_receita_grouped = pd.DataFrame(columns=["data", "receitas"])
        
   
        df_outros["data"] = pd.to_datetime(df_outros["data"]) if not df_outros.empty else pd.Series(dtype='datetime64[ns]')
        df_outros_ = df_outros[["data", "valor"]] if not df_outros.empty else pd.DataFrame(columns=["data", "valor"])
        df_despesas = df_outros_ if not df_outros_.empty else pd.DataFrame(columns=["data", "valor"])
        
        if df_despesas.empty:
            df_despesas_grouped = pd.DataFrame({"data": [], "despesas": []})
        else:
            df_despesas_grouped = df_despesas.groupby("data")["valor"].sum().reset_index(name="despesas")
        

        dias = pd.date_range(
            start=f"{ano}-{mes.zfill(2)}-01", 
            end=pd.Timestamp(f"{ano}-{mes.zfill(2)}-01") + pd.offsets.MonthEnd(0)
        )
        df_base = pd.DataFrame({"data": dias})
        

        df_merged = pd.merge(df_base, df_receita_grouped, on="data", how="left").merge(df_despesas_grouped, on="data", how="left")
        df_merged["receitas"] = df_merged["receitas"].fillna(0)
        df_merged["despesas"] = df_merged["despesas"].fillna(0)
        df_merged["saldo_dia"] = df_merged["receitas"] - df_merged["despesas"]
        df_merged["saldo_acumulado"] = df_merged["saldo_dia"].cumsum()
        

        evolucao = []
        for _, row in df_merged.iterrows():
            evolucao.append({
                'data': row['data'].strftime('%Y-%m-%d'),
                'receitas': float(row['receitas']),
                'despesas': float(row['despesas']),
                'saldo_dia': float(row['saldo_dia']),
                'saldo_acumulado': float(row['saldo_acumulado'])
            })
        

        df_gastos = gastos_mensais('6m')
        gastos_mensais_data = []
        for _, row in df_gastos.iterrows():
            gastos_mensais_data.append({
                'mes': row['AnoMes'],
                'valor': float(row['valor'])
            })
        

        resumo = {
            'carteira': {
                'ativos': carteira,
                'total_investido': total_investido,
                'quantidade_ativos': len(carteira),
                'distribuicao_por_tipo': ativos_por_tipo
            },
            'receitas': {
                'registros': receitas,
                'total': total_receitas,
                'quantidade': len(receitas)
            },
            
            'outros': {
                'registros': outros,
                'total': total_outros,
                'quantidade': len(outros)
            },
            'marmitas': {
                'registros': marmitas_formatted,
                'total': total_marmitas,
                'quantidade': len(marmitas_formatted)
            },
            'saldo': saldo,
            'evolucao_financeira': evolucao,
            'gastos_mensais': gastos_mensais_data,
            'total_despesas': total_outros + total_marmitas
        }
        

        

        try:
            if cache:
                cache.set(_cache_key(), resumo, timeout=60)
        except Exception:
            pass
        return jsonify(resumo)
    except Exception as e:
        print(f"Erro na API home/resumo: {str(e)}")
        return jsonify({"error": str(e)}), 500


@server.route("/api/exchange-rate/<symbol>", methods=["GET"])
def api_get_exchange_rate(symbol):
    try:
      
        ticker = yf.Ticker(symbol)
        historico = ticker.history(period='1d')
        
        if historico is not None and not historico.empty:

            latest_data = historico.iloc[-1]
            return jsonify({
                "symbol": symbol,
                "rate": float(latest_data['Close']),
                "date": latest_data.name.isoformat(),
                "volume": float(latest_data['Volume']) if 'Volume' in latest_data else 0
            })
        else:
            return jsonify({"error": "Dados não encontrados"}), 404
            
    except Exception as e:
        print(f"Erro ao buscar taxa de câmbio para {symbol}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ==================== ENDPOINTS DE CARTÕES CADASTRADOS ====================

@server.route("/api/controle/cartoes-cadastrados", methods=["GET", "POST", "PUT", "DELETE"])
def api_cartoes_cadastrados():
    try:
        if request.method == "GET":
            # Rollover mensal: se o mês virou, liberar novamente o status de pagamento
            try:
                resetar_status_cartoes_novo_mes()
            except Exception:
                pass
            cartoes = listar_cartoes_cadastrados()
            return jsonify(cartoes)
        
        elif request.method == "POST":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = adicionar_cartao_cadastrado(
                data.get('nome'),
                data.get('bandeira'),
                data.get('limite'),
                data.get('vencimento'),
                data.get('cor')
            )
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Cartão cadastrado com sucesso"})
        
        elif request.method == "PUT":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = atualizar_cartao_cadastrado(
                data.get('id'),
                nome=data.get('nome'),
                bandeira=data.get('bandeira'),
                limite=data.get('limite'),
                vencimento=data.get('vencimento'),
                cor=data.get('cor'),
                ativo=data.get('ativo')
            )
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Cartão atualizado com sucesso"})
        
        elif request.method == "DELETE":
            cartao_id = request.args.get('id')
            if not cartao_id:
                return jsonify({"error": "ID do cartão é obrigatório"}), 400
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = remover_cartao_cadastrado(int(cartao_id))
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Cartão removido com sucesso"})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/compras-cartao", methods=["GET", "POST", "PUT", "DELETE"])
def api_compras_cartao():
    try:
        if request.method == "GET":
            cartao_id = request.args.get('cartao_id')
            mes = request.args.get('mes')
            ano = request.args.get('ano')
            if not cartao_id:
                return jsonify({"error": "ID do cartão é obrigatório"}), 400
            compras = listar_compras_cartao(int(cartao_id), mes, ano)
            return jsonify(compras)
        
        elif request.method == "POST":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = adicionar_compra_cartao(
                data.get('cartao_id'),
                data.get('nome'),
                data.get('valor'),
                data.get('data'),
                categoria=data.get('categoria'),
                observacao=data.get('observacao')
            )
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Compra adicionada com sucesso"})
        
        elif request.method == "PUT":
            data = request.get_json()
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = atualizar_compra_cartao(
                data.get('id'),
                nome=data.get('nome'),
                valor=data.get('valor'),
                data=data.get('data'),
                categoria=data.get('categoria'),
                observacao=data.get('observacao')
            )
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Compra atualizada com sucesso"})
        
        elif request.method == "DELETE":
            compra_id = request.args.get('id')
            if not compra_id:
                return jsonify({"error": "ID da compra é obrigatório"}), 400
            try:
                _upgrade_controle_schema()
            except Exception:
                pass
            res = remover_compra_cartao(int(compra_id))
            if isinstance(res, dict) and not res.get('success', True):
                return jsonify(res), 401
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"message": "Compra removida com sucesso"})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/total-compras-cartao", methods=["GET"])
def api_total_compras_cartao():
    try:
        cartao_id = request.args.get('cartao_id')
        mes = request.args.get('mes')
        ano = request.args.get('ano')
        if not cartao_id:
            return jsonify({"error": "ID do cartão é obrigatório"}), 400
        total = calcular_total_compras_cartao(int(cartao_id), mes, ano)
        return jsonify({"total": total})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/marcar-cartao-pago", methods=["POST"])
def api_marcar_cartao_pago():
    try:
        data = request.get_json()
        cartao_id = data.get('cartao_id')
        mes_pagamento = data.get('mes_pagamento')
        ano_pagamento = data.get('ano_pagamento')
        
        if not all([cartao_id, mes_pagamento, ano_pagamento]):
            return jsonify({"error": "cartao_id, mes_pagamento e ano_pagamento são obrigatórios"}), 400
        
        success = marcar_cartao_como_pago(cartao_id, mes_pagamento, ano_pagamento)
        
        if success:
          
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"success": True, "message": "Cartão marcado como pago e convertido em despesa"})
        else:
            return jsonify({"error": "Erro ao marcar cartão como pago"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/controle/desmarcar-cartao-pago", methods=["POST"])
def api_desmarcar_cartao_pago():
    try:
        data = request.get_json()
        cartao_id = data.get('cartao_id')
        
        if not cartao_id:
            return jsonify({"error": "cartao_id é obrigatório"}), 400
        
        success = desmarcar_cartao_como_pago(cartao_id)
        
        if success:
       
            try:
                if cache:
                    cache.clear()
            except Exception:
                pass
            return jsonify({"success": True, "message": "Cartão desmarcado como pago e despesa removida"})
        else:
            return jsonify({"error": "Erro ao desmarcar cartão como pago"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== ENDPOINTS DE SIMULAÇÃO ====================

@server.route("/api/simulador/choques", methods=["POST"])
def api_simulador_choques():
    
    try:
        data = request.get_json()
        choques_cdi = data.get('choques_cdi', 0)
        choques_ipca = data.get('choques_ipca', 0)
        choques_selic = data.get('choques_selic', 0)
        
        resultado = simular_choques_indexadores(choques_cdi, choques_ipca, choques_selic)
        
        if "error" in resultado:
            return jsonify(resultado), 400
            
        return jsonify(resultado)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/simulador/cenarios", methods=["GET"])
def api_simulador_cenarios():

    try:
        cenarios = obter_cenarios_predefinidos()
        return jsonify({"cenarios": cenarios})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@server.route("/api/simulador/monte-carlo", methods=["POST"])
def api_simulador_monte_carlo():
    """Endpoint para executar simulação Monte Carlo"""
    try:
        data = request.get_json()
        n_simulacoes = data.get('nSimulacoes', 10000)
        periodo_anos = data.get('periodoAnos', 5)
        confianca = data.get('confianca', 95)
        
        resultado = executar_monte_carlo(n_simulacoes, periodo_anos, confianca)
        
        if "error" in resultado:
            return jsonify(resultado), 400
            
        return jsonify(resultado)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== API MERCADOS B3 ====================

@server.route("/api/mercados/bdrs", methods=["GET"])
def api_mercados_bdrs():
    """
    API para BDRs (Brazilian Depositary Receipts)
    """
    try:
        limite = request.args.get('limite', 50, type=int)
        from mercados_api import mercados_api
        resultado = mercados_api.obter_bdrs(limite)
        return jsonify({
            "bdrs": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/debentures", methods=["GET"])
def api_mercados_debentures():
    """
    API para Debentures
    """
    try:
        limite = request.args.get('limite', 50, type=int)
        from mercados_api import mercados_api
        resultado = mercados_api.obter_debentures(limite)
        return jsonify({
            "debentures": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/cris", methods=["GET"])
def api_mercados_cris():
    """
    API para CRIs (Certificados de Recebíveis Imobiliários)
    """
    try:
        limite = request.args.get('limite', 50, type=int)
        from mercados_api import MercadosAPI
        api_instance = MercadosAPI()
   
        resultado = api_instance.obter_cris(limite)

        return jsonify({
            "cris": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        import traceback
   
        return jsonify({"erro": str(e), "traceback": traceback.format_exc()}), 500

@server.route("/api/mercados/cras", methods=["GET"])
def api_mercados_cras():

    try:
        limite = request.args.get('limite', 50, type=int)
        from mercados_api import mercados_api
        resultado = mercados_api.obter_cras(limite)
        return jsonify({
            "cras": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/ibov", methods=["GET"])
def api_mercados_ibov():

    try:
        from mercados_api import mercados_api
        resultado = mercados_api.obter_carteira_ibov()
        return jsonify({
            "ibov": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/negociacoes-balcao", methods=["GET"])
def api_mercados_negociacoes_balcao():
    """
    API para negociações de balcão
    """
    try:
        limite = request.args.get('limite', 100, type=int)
        data_str = request.args.get('data')
        
        data = None
        if data_str:
            try:
                data = datetime.strptime(data_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        from mercados_api import mercados_api
        resultado = mercados_api.obter_negociacoes_balcao(data, limite)
        return jsonify({
            "negociacoes_balcao": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/negociacoes-intraday", methods=["GET"])
def api_mercados_negociacoes_intraday():

    try:
        limite = request.args.get('limite', 100, type=int)
        data_str = request.args.get('data')
        
        data = None
        if data_str:
            try:
                data = datetime.strptime(data_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        from mercados_api import mercados_api
        resultado = mercados_api.obter_negociacoes_intraday(data, limite)
        return jsonify({
            "negociacoes_intraday": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/securitizadoras", methods=["GET"])
def api_mercados_securitizadoras():
    """
    API para securitizadoras
    """
    try:
        from mercados_api import mercados_api
        resultado = mercados_api.obter_securitizadoras()
        return jsonify({
            "securitizadoras": resultado,
            "total": len(resultado),
            "data_atualizacao": datetime.now().strftime('%Y-%m-%d')
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/mercados/resumo", methods=["GET"])
def api_mercados_resumo():
    """
    API para resumo completo do mercado
    """
    try:
        from mercados_api import mercados_api
        resultado = mercados_api.obter_resumo_mercado()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@server.route("/api/dividendos/agenda", methods=["GET"])
def api_agenda_dividendos():
    """
    API para buscar agenda de dividendos do mercado completo
    Parâmetros:
    - mes: mês (1-12), padrão: mês atual
    - ano: ano (ex: 2024), padrão: ano atual
    - tipos: tipos de ativos separados por vírgula (acoes,fiis,bdrs), padrão: todos
    """
    mes = None
    ano = None
    try:
        from scraper_agenda_dividendos_investidor10 import buscar_agenda_dividendos
        
        # Obter parâmetros
        mes = request.args.get('mes', type=int)
        ano = request.args.get('ano', type=int)
        tipos_str = request.args.get('tipos', 'acoes,fiis,bdrs')
        
        print(f"[AGENDA DIVIDENDOS] Recebida requisicao: mes={mes}, ano={ano}, tipos={tipos_str}")
        
        # Processar tipos
        tipos = [t.strip() for t in tipos_str.split(',') if t.strip() in ['acoes', 'fiis', 'bdrs']]
        if not tipos:
            tipos = ['acoes', 'fiis', 'bdrs']
        
        # Buscar agenda (o scraper retorna todos os tipos, vamos filtrar depois se necessário)
        print(f"[AGENDA DIVIDENDOS] Chamando buscar_agenda_dividendos (investidor10)...")
        try:
            resultado = buscar_agenda_dividendos(mes=mes, ano=ano, tipo_ativo=None)
            print(f"[AGENDA DIVIDENDOS] Resultado recebido: acoes={resultado.get('acoes', {}).get('total', 0)}, fiis={resultado.get('fiis', {}).get('total', 0)}, bdrs={resultado.get('bdrs', {}).get('total', 0)}")
        except Exception as e:
            print(f"[ERRO] Erro ao chamar buscar_agenda_dividendos: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Se tipos específicos foram solicitados, filtrar resultado
        if len(tipos) < 3:
            if 'acoes' not in tipos:
                resultado['acoes'] = {'total': 0, 'dividendos': [], 'total_estimado': 0}
            if 'fiis' not in tipos:
                resultado['fiis'] = {'total': 0, 'dividendos': [], 'total_estimado': 0}
            if 'bdrs' not in tipos:
                resultado['bdrs'] = {'total': 0, 'dividendos': [], 'total_estimado': 0}
        
        return jsonify(resultado)
        
    except ImportError as e:
        print(f"[ERRO] Erro de importacao na API de agenda de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "erro": f"Erro de importacao: {str(e)}",
            "mes": mes or datetime.now().month,
            "ano": ano or datetime.now().year,
            "acoes": {"total": 0, "dividendos": [], "total_estimado": 0},
            "fiis": {"total": 0, "dividendos": [], "total_estimado": 0},
            "bdrs": {"total": 0, "dividendos": [], "total_estimado": 0}
        }), 500
    except Exception as e:
        print(f"[ERRO] Erro na API de agenda de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "erro": str(e),
            "mes": mes or datetime.now().month,
            "ano": ano or datetime.now().year,
            "acoes": {"total": 0, "dividendos": [], "total_estimado": 0},
            "fiis": {"total": 0, "dividendos": [], "total_estimado": 0},
            "bdrs": {"total": 0, "dividendos": [], "total_estimado": 0}
        }), 500

@server.route("/api/dividendos/ranking", methods=["GET"])
def api_ranking_dividendos():
    """
    API para buscar ranking de dividendos do mercado completo
    Parâmetros:
    - tipo: tipo de ativo (acoes, fiis, bdrs), padrão: todos
    - mes: mês para filtrar por data-com (1-12), padrão: None (ranking geral)
    - ano: ano para filtrar por data-com, padrão: None (ranking geral)
    """
    try:
        from scraper_ranking_dividendos import buscar_todos_rankings, buscar_ranking_dividendos
        
        tipo = request.args.get('tipo', None)
        mes = request.args.get('mes', type=int)
        ano = request.args.get('ano', type=int)
        
        print(f"[RANKING DIVIDENDOS] Recebida requisicao: tipo={tipo}, mes={mes}, ano={ano}")
        
        if tipo and tipo in ['acoes', 'fiis', 'bdrs']:
            # Buscar apenas um tipo específico
            print(f"[RANKING DIVIDENDOS] Chamando buscar_ranking_dividendos para tipo={tipo}, mes={mes}, ano={ano}...")
            resultado = buscar_ranking_dividendos(tipo, mes=mes, ano=ano)
            print(f"[RANKING DIVIDENDOS] Resultado recebido: total={resultado.get('total', 0)}")
            return jsonify(resultado)
        else:
            # Buscar todos os tipos
            print(f"[RANKING DIVIDENDOS] Chamando buscar_todos_rankings com mes={mes}, ano={ano}...")
            resultado = buscar_todos_rankings(mes=mes, ano=ano)
            print(f"[RANKING DIVIDENDOS] Resultado recebido: acoes={resultado.get('acoes', {}).get('total', 0)}, fiis={resultado.get('fiis', {}).get('total', 0)}, bdrs={resultado.get('bdrs', {}).get('total', 0)}")
            return jsonify(resultado)
        
    except ImportError as e:
        print(f"[ERRO] Erro de importacao na API de ranking de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "erro": f"Erro de importacao: {str(e)}",
            "data_busca": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "acoes": {"total": 0, "ranking": []},
            "fiis": {"total": 0, "ranking": []},
            "bdrs": {"total": 0, "ranking": []}
        }), 500
    except Exception as e:
        print(f"[ERRO] Erro na API de ranking de dividendos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "erro": str(e),
            "data_busca": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "acoes": {"total": 0, "ranking": []},
            "fiis": {"total": 0, "ranking": []},
            "bdrs": {"total": 0, "ranking": []}
        }), 500

# ==================== RANKING DE ATIVOS (LISTA COMPLETA BRAPI.DEV) ====================

@server.route("/api/ranking/atualizar-lista", methods=["POST"])
def api_atualizar_lista_ranking():
    """
    Endpoint para forçar atualização da lista completa de ativos do Brapi.dev
    Ignora cache de 24h e atualiza imediatamente
    
    Uso: POST /api/ranking/atualizar-lista
    """
    try:
        from brapi_lista_completa import atualizar_lista_brapi
        
        print("[API] Solicitacao de atualizacao da lista de ranking")
        resultado = atualizar_lista_brapi(forcar=True)
        
        if resultado.get('success'):
            return jsonify(resultado), 200
        else:
            return jsonify(resultado), 500
            
    except Exception as e:
        print(f"[ERRO] Erro ao atualizar lista de ranking: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@server.route("/api/ranking/investidor10", methods=["GET"])
def api_ranking_investidor10():

    try:
        from scraper_rankings_investidor10 import buscar_rankings_investidor10
        
        tipo = request.args.get('tipo', 'acoes')
        
        if tipo not in ['acoes', 'fiis', 'bdrs', 'criptos']:
            return jsonify({"erro": "Tipo invalido. Use: acoes, fiis, bdrs ou criptos"}), 400
        
        print(f"[RANKING INVESTIDOR10] Buscando rankings de {tipo}...")
        resultado = buscar_rankings_investidor10(tipo)
        
        if resultado.get('erro'):
            return jsonify(resultado), 500
        
        return jsonify(resultado), 200
        
    except Exception as e:
        print(f"[ERRO] Erro ao buscar rankings do investidor10: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500

@server.route("/api/ranking/lista", methods=["GET"])
def api_obter_lista_ranking():

    try:
        from brapi_lista_completa import carregar_lista_brapi_arquivo, atualizar_lista_brapi
        
        # Tentar carregar do arquivo
        lista = carregar_lista_brapi_arquivo()
        
        # Se não existe ou está desatualizada, atualizar
        if not lista:
            print("[API] Lista nao encontrada. Atualizando...")
            resultado = atualizar_lista_brapi(forcar=True)
            if resultado.get('success'):
                lista = carregar_lista_brapi_arquivo()
        else:
            # Verificar se precisa atualizar (automático a cada 24h)
            try:
                ultima_atualizacao = lista.get('ultima_atualizacao', '')
                if ultima_atualizacao:
                    ultima_dt = datetime.strptime(ultima_atualizacao, "%Y-%m-%d %H:%M:%S")
                    horas_desde_atualizacao = (datetime.now() - ultima_dt).total_seconds() / 3600
                    
                    if horas_desde_atualizacao >= 24:
                        print(f"[API] Lista desatualizada ({horas_desde_atualizacao:.1f}h). Atualizando automaticamente...")
                        resultado = atualizar_lista_brapi(forcar=False)  # Não força, mas atualiza se > 24h
                        if resultado.get('success'):
                            lista = carregar_lista_brapi_arquivo()
            except:
                pass
        
        if lista:
            return jsonify({
                "success": True,
                "dados": {
                    "acoes_brasileiras": lista.get('acoes_brasileiras', []),
                    "fiis_brasileiros": lista.get('fiis_brasileiros', []),
                    "bdrs": lista.get('bdrs', []),
                    "stocks_internacionais": lista.get('stocks_internacionais', []),
                    "outros": lista.get('outros', []),
                    "total": lista.get('total', 0),
                    "ultima_atualizacao": lista.get('ultima_atualizacao', ''),
                    "fonte": lista.get('fonte', 'brapi.dev')
                }
            }), 200
        else:
            return jsonify({"success": False, "message": "Lista nao disponivel"}), 404
            
    except Exception as e:
        print(f"[ERRO] Erro ao obter lista de ranking: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == "__main__":
    server.run(debug=False, port=5005, host='0.0.0.0') 