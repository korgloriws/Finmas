#!/usr/bin/env python3
"""
Script de teste para verificar isolamento entre usuários
Este script testa se o cache está sendo limpo corretamente entre usuários
"""

import requests
import json
import time
import sys

# Configuração
BASE_URL = "http://localhost:5000"  # Ajuste conforme necessário
TEST_USER1 = "teste_usuario1"
TEST_USER2 = "teste_usuario2"
TEST_PASSWORD = "senha123"

def test_user_isolation():
    """Testa isolamento entre usuários"""
    print("🔒 TESTE DE ISOLAMENTO ENTRE USUÁRIOS")
    print("=" * 50)
    
    session = requests.Session()
    
    try:
        # 1. Login com usuário 1
        print("1. Fazendo login com usuário 1...")
        login_data = {
            "username": TEST_USER1,
            "senha": TEST_PASSWORD
        }
        
        response = session.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code != 200:
            print(f"❌ Erro no login usuário 1: {response.text}")
            return False
            
        print("✅ Login usuário 1 realizado")
        
        # 2. Adicionar dados para usuário 1
        print("2. Adicionando dados para usuário 1...")
        carteira_data = {
            "ticker": "PETR4",
            "quantidade": 100,
            "tipo": "Ação"
        }
        
        response = session.post(f"{BASE_URL}/api/carteira/adicionar", json=carteira_data)
        if response.status_code != 200:
            print(f"❌ Erro ao adicionar ativo usuário 1: {response.text}")
            return False
            
        print("✅ Ativo adicionado para usuário 1")
        
        # 3. Verificar dados do usuário 1
        print("3. Verificando dados do usuário 1...")
        response = session.get(f"{BASE_URL}/api/carteira")
        if response.status_code != 200:
            print(f"❌ Erro ao buscar carteira usuário 1: {response.text}")
            return False
            
        carteira_usuario1 = response.json()
        print(f"✅ Carteira usuário 1: {len(carteira_usuario1)} ativos")
        
        # 4. Logout usuário 1
        print("4. Fazendo logout usuário 1...")
        response = session.post(f"{BASE_URL}/api/auth/logout")
        if response.status_code != 200:
            print(f"❌ Erro no logout usuário 1: {response.text}")
            return False
            
        print("✅ Logout usuário 1 realizado")
        
        # 5. Login com usuário 2
        print("5. Fazendo login com usuário 2...")
        login_data = {
            "username": TEST_USER2,
            "senha": TEST_PASSWORD
        }
        
        response = session.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code != 200:
            print(f"❌ Erro no login usuário 2: {response.text}")
            return False
            
        print("✅ Login usuário 2 realizado")
        
        # 6. Verificar se usuário 2 NÃO vê dados do usuário 1
        print("6. Verificando isolamento - usuário 2 não deve ver dados do usuário 1...")
        response = session.get(f"{BASE_URL}/api/carteira")
        if response.status_code != 200:
            print(f"❌ Erro ao buscar carteira usuário 2: {response.text}")
            return False
            
        carteira_usuario2 = response.json()
        print(f"📊 Carteira usuário 2: {len(carteira_usuario2)} ativos")
        
        # 7. Verificar isolamento
        if len(carteira_usuario2) > 0:
            print("❌ FALHA DE SEGURANÇA: Usuário 2 vê dados do usuário 1!")
            print(f"   Dados encontrados: {carteira_usuario2}")
            return False
        else:
            print("✅ ISOLAMENTO OK: Usuário 2 não vê dados do usuário 1")
        
        # 8. Adicionar dados para usuário 2
        print("8. Adicionando dados para usuário 2...")
        carteira_data = {
            "ticker": "VALE3",
            "quantidade": 50,
            "tipo": "Ação"
        }
        
        response = session.post(f"{BASE_URL}/api/carteira/adicionar", json=carteira_data)
        if response.status_code != 200:
            print(f"❌ Erro ao adicionar ativo usuário 2: {response.text}")
            return False
            
        print("✅ Ativo adicionado para usuário 2")
        
        # 9. Verificar dados do usuário 2
        print("9. Verificando dados do usuário 2...")
        response = session.get(f"{BASE_URL}/api/carteira")
        if response.status_code != 200:
            print(f"❌ Erro ao buscar carteira usuário 2: {response.text}")
            return False
            
        carteira_usuario2_final = response.json()
        print(f"✅ Carteira usuário 2 final: {len(carteira_usuario2_final)} ativos")
        
        # 10. Logout usuário 2
        print("10. Fazendo logout usuário 2...")
        response = session.post(f"{BASE_URL}/api/auth/logout")
        if response.status_code != 200:
            print(f"❌ Erro no logout usuário 2: {response.text}")
            return False
            
        print("✅ Logout usuário 2 realizado")
        
        print("\n🎉 TESTE CONCLUÍDO COM SUCESSO!")
        print("✅ Isolamento entre usuários funcionando corretamente")
        return True
        
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        return False

def test_emergency_cache_clear():
    """Testa o endpoint de limpeza de emergência"""
    print("\n🚨 TESTE DE LIMPEZA DE EMERGÊNCIA")
    print("=" * 50)
    
    try:
        response = requests.post(f"{BASE_URL}/api/emergency/clear-cache")
        if response.status_code == 200:
            print("✅ Limpeza de emergência executada com sucesso")
            return True
        else:
            print(f"❌ Erro na limpeza de emergência: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erro ao testar limpeza de emergência: {e}")
        return False

if __name__ == "__main__":
    print("🔒 INICIANDO TESTES DE SEGURANÇA")
    print("=" * 50)
    
    # Teste de limpeza de emergência
    emergency_ok = test_emergency_cache_clear()
    
    # Teste de isolamento entre usuários
    isolation_ok = test_user_isolation()
    
    print("\n📊 RESULTADOS DOS TESTES")
    print("=" * 50)
    print(f"Limpeza de emergência: {'✅ OK' if emergency_ok else '❌ FALHOU'}")
    print(f"Isolamento entre usuários: {'✅ OK' if isolation_ok else '❌ FALHOU'}")
    
    if emergency_ok and isolation_ok:
        print("\n🎉 TODOS OS TESTES PASSARAM!")
        sys.exit(0)
    else:
        print("\n❌ ALGUNS TESTES FALHARAM!")
        sys.exit(1)
