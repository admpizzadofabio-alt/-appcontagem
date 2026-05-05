import asyncio
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:8787"
results = []

def ok(name):
    results.append(("OK", name, ""))
    print(f"  [OK]   {name}")

def fail(name, reason=""):
    results.append(("FAIL", name, reason))
    print(f"  [FAIL] {name}" + (f"  >>  {reason[:100]}" if reason else ""))

def warn(name, reason=""):
    results.append(("WARN", name, reason))
    print(f"  [WARN] {name}" + (f"  >>  {reason}" if reason else ""))

async def dismiss_sweetalert(page):
    """Cancela SweetAlert se estiver aberto, sem usar Escape."""
    swal = page.locator('.swal2-popup')
    if await swal.count():
        cancel = page.locator('.swal2-cancel, .swal2-deny')
        if await cancel.count():
            await cancel.first.click()
        else:
            confirm = page.locator('.swal2-confirm')
            if await confirm.count():
                await confirm.first.click()
        try:
            await page.wait_for_selector('.swal2-popup', state='hidden', timeout=2000)
        except Exception:
            pass

async def go_home(page):
    """Garante que não há SweetAlert aberto e navega para home."""
    await dismiss_sweetalert(page)
    await page.evaluate("app.navigate('home')")
    await page.wait_for_selector("#view-home", state="visible", timeout=5000)
    await page.wait_for_timeout(200)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        ctx = await browser.new_page()
        page = ctx

        js_errs = []
        page.on("pageerror", lambda e: js_errs.append(str(e)))

        print("=" * 55)
        print("  TESTE DE BOTOES — APPCONTAGEM")
        print("=" * 55)

        # ── LOGIN ──────────────────────────────────────────────
        print("\n[LOGIN]")
        try:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_selector("#view-login", state="visible", timeout=12000)
            for digit in "1234":
                await page.click(f'.key:text-is("{digit}")')
                await page.wait_for_timeout(80)
            await page.click('#key-enter')
            await page.wait_for_selector("#view-home", state="visible", timeout=8000)
            ok("Login com PIN 1234")
        except Exception as e:
            fail("Login com PIN 1234", str(e))
            await browser.close()
            return

        # ── NOTIFICAÇÕES ────────────────────────────────────────
        print("\n[NOTIFICACOES]")
        try:
            await page.click('#notification-bell')
            await page.wait_for_timeout(400)
            visible = await page.locator('.notif-panel').is_visible()
            ok("Sino de notificacoes abre painel") if visible else warn("Sino de notificacoes", "painel nao visivel")
            # fechar
            await page.click('#notification-bell')
            await page.wait_for_timeout(200)
        except Exception as e:
            fail("Notificacoes", str(e))

        # ── SINCRONIZACAO ───────────────────────────────────────
        print("\n[SINCRONIZACAO]")
        try:
            err_before = len(js_errs)
            sync_btn = page.locator('button[onclick*="forceCloudSync"]').first
            await sync_btn.click()
            await page.wait_for_timeout(800)
            ok("Forca sincronizacao — sem crash") if len(js_errs) == err_before else warn("Forca sincronizacao", "erros JS apos clique")
        except Exception as e:
            fail("Forca sincronizacao", str(e))

        # ── QUICK ACTIONS (HOME) ────────────────────────────────
        print("\n[HOME — Quick Actions]")

        # Usar onclick como seletor (evita problema com acentos)
        casos = [
            ("Entradas",       "[onclick*=\"openMovimentacao('Entrada')\"]",   "#view-movimentacao"),
            ("Perdas",         "[onclick*=\"openMovimentacao('Ajuste\"]",       "#view-movimentacao"),
            ("Transferencia",  "[onclick*=\"transferencia\"]",                  "#view-transferencia"),
            ("Conferencia",    "[onclick*=\"contagem-setup\"]",                 "#view-contagem-setup"),
            ("Historico",      "[onclick*=\"meu-historico\"]",                  "#view-meu-historico"),
            ("Relatorios",     ".action-btn[onclick*=\"relatorios\"]",          "#view-relatorios"),
        ]
        for label, selector, view_id in casos:
            try:
                await go_home(page)
                btn = page.locator(selector).first
                await btn.scroll_into_view_if_needed()
                await btn.click()
                await page.wait_for_selector(view_id, state="visible", timeout=4000)
                ok(f"Botao '{label}'")
            except Exception as e:
                fail(f"Botao '{label}'", str(e))

        # Solicitar Material
        try:
            await go_home(page)
            btn_sol = page.locator('[onclick*="Orders.openModal"]').first
            await btn_sol.scroll_into_view_if_needed()
            await btn_sol.click()
            await page.wait_for_selector("#modal-pedido.active", timeout=4000)
            ok("Botao 'Solicitar Material' — abre modal")
            # fechar
            await page.click('#modal-pedido .modal-close')
            await page.wait_for_timeout(300)
        except Exception as e:
            fail("Botao 'Solicitar Material'", str(e))

        # ADMIN submenu
        try:
            await go_home(page)
            admin_btn = page.locator('[onclick*="nextElementSibling.classList.toggle"]').first
            await admin_btn.scroll_into_view_if_needed()
            await admin_btn.click()
            await page.wait_for_timeout(400)
            count = await page.locator('.submenu.active').count()
            ok("Botao ADMIN — abre submenu") if count > 0 else fail("Botao ADMIN — submenu nao abriu")
        except Exception as e:
            fail("Botao ADMIN submenu", str(e))

        # ── ESTOQUE ─────────────────────────────────────────────
        print("\n[ESTOQUE]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('estoque')")
            await page.wait_for_selector("#view-estoque", state="visible", timeout=4000)
            ok("Navegar para Estoque")

            await page.click('.tab-btn[onclick*="Bar"]')
            await page.wait_for_timeout(300)
            ativo = await page.locator('.tab-btn[onclick*="Bar"].active').count()
            ok("Aba Bar") if ativo else fail("Aba Bar — nao ficou ativa")

            await page.click('.tab-btn[onclick*="Delivery"]')
            await page.wait_for_timeout(300)
            ativo = await page.locator('.tab-btn[onclick*="Delivery"].active').count()
            ok("Aba Delivery") if ativo else fail("Aba Delivery — nao ficou ativa")
        except Exception as e:
            fail("Estoque", str(e))

        # ── RELATORIOS ──────────────────────────────────────────
        print("\n[RELATORIOS]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('relatorios')")
            await page.wait_for_selector("#view-relatorios", state="visible", timeout=4000)
            ok("Navegar para Relatorios")

            tabs = [
                ("tab-macro",            "Visao Macro"),
                ("tab-estoque",          "Estoque Atual"),
                ("tab-saidas",           "Saidas/Consumo"),
                ("tab-perdas",           "Perdas/Ajustes"),
                ("tab-contagens",        "Contagens"),
                ("tab-pedidos",          "Pedidos"),
                ("tab-auditoria-diaria", "Auditoria Diaria"),
            ]
            for tab_id, label in tabs:
                try:
                    await page.click(f'.tab-btn[data-target="{tab_id}"]')
                    await page.wait_for_timeout(350)
                    ativo = await page.locator(f'.tab-btn[data-target="{tab_id}"].active').count()
                    ok(f"Aba '{label}'") if ativo else fail(f"Aba '{label}' — nao ativa")
                except Exception as e:
                    fail(f"Aba '{label}'", str(e))

            # Aplicar Filtros
            try:
                await page.click('button[onclick*="renderActiveTab"]')
                await page.wait_for_timeout(400)
                ok("Botao 'Aplicar Filtros'")
            except Exception as e:
                fail("Botao 'Aplicar Filtros'", str(e))

            # Exportar PDF (window.print)
            try:
                await page.evaluate("window._printCalled = false; window.print = () => { window._printCalled = true; }")
                await page.click('button[onclick*="generateComprehensiveReport"]')
                await page.wait_for_timeout(500)
                called = await page.evaluate("window._printCalled")
                ok("Botao 'Exportar PDF'") if called else warn("Botao 'Exportar PDF'", "window.print nao chamado")
            except Exception as e:
                fail("Botao 'Exportar PDF'", str(e))

        except Exception as e:
            fail("Relatorios (abertura)", str(e))

        # ── ADMIN PANEL ─────────────────────────────────────────
        print("\n[ADMIN PANEL]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('admin')")
            await page.wait_for_selector("#view-admin", state="visible", timeout=4000)
            ok("Navegar para Admin Panel")

            # Reset Estoque (deve abrir SweetAlert de confirmação)
            await page.click('button[onclick*="resetData(\'movements\')"]')
            try:
                # Aguarda SweetAlert aparecer (pode levar um momento)
                await page.wait_for_selector('.swal2-popup', state='visible', timeout=4000)
                ok("Botao 'Zerar Estoque' — abre confirmacao")
            except Exception:
                fail("Botao 'Zerar Estoque'", "SweetAlert nao apareceu")
            # Sempre cancela para não apagar dados, e aguarda fechar
            await dismiss_sweetalert(page)
            await page.wait_for_timeout(300)

            # Backup
            try:
                err_before = len(js_errs)
                backup_btn = page.locator('button[onclick*="exportBackup"]').first
                await backup_btn.scroll_into_view_if_needed()
                await backup_btn.click()
                await page.wait_for_timeout(500)
                ok("Botao 'Gerar Backup' — sem crash") if len(js_errs) == err_before else fail("Botao 'Gerar Backup'", "erro JS")
            except Exception as e:
                fail("Botao 'Gerar Backup'", str(e))

        except Exception as e:
            fail("Admin Panel", str(e))

        # ── USUARIOS ────────────────────────────────────────────
        print("\n[USUARIOS]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('usuarios')")
            await page.wait_for_selector("#view-usuarios", state="visible", timeout=4000)
            ok("Navegar para Usuarios")

            novo_usr = page.locator('#btn-novo-usuario')
            await novo_usr.scroll_into_view_if_needed()
            await novo_usr.click()
            await page.wait_for_selector("#user-modal.active", timeout=4000)
            ok("Botao 'Novo Usuario' — abre modal")

            await page.click('#btn-close-user-modal')
            await page.wait_for_timeout(400)
            fechado = not await page.locator("#user-modal.active").count()
            ok("Fechar modal usuario") if fechado else fail("Fechar modal usuario")
        except Exception as e:
            fail("Usuarios", str(e))

        # ── PRODUTOS ────────────────────────────────────────────
        print("\n[PRODUTOS]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('produtos')")
            await page.wait_for_selector("#view-produtos", state="visible", timeout=4000)
            ok("Navegar para Produtos")

            novo_prod = page.locator('#btn-novo-produto')
            await novo_prod.scroll_into_view_if_needed()
            await novo_prod.click()
            await page.wait_for_selector("#product-modal.active", timeout=4000)
            ok("Botao 'Novo Produto' — abre modal")

            await page.click('#btn-close-product-modal')
            await page.wait_for_timeout(400)
            fechado = not await page.locator("#product-modal.active").count()
            ok("Fechar modal produto") if fechado else fail("Fechar modal produto")
        except Exception as e:
            fail("Produtos", str(e))

        # ── MOVIMENTACAO ────────────────────────────────────────
        print("\n[MOVIMENTACAO]")
        try:
            await go_home(page)
            await page.evaluate("app.openMovimentacao('Entrada')")
            await page.wait_for_selector("#view-movimentacao", state="visible", timeout=4000)
            ok("Abrir Movimentacao (Entrada)")

            input_qty = page.locator('#mov-qtd').first
            val_ini = await input_qty.input_value()
            await page.locator('#view-movimentacao .number-input button').last.click()
            await page.wait_for_timeout(200)
            val_dep = await input_qty.input_value()
            ok("Botao '+' quantidade") if val_dep != val_ini else warn("Botao '+' quantidade", "valor nao alterou")

            await page.locator('#view-movimentacao .number-input button').first.click()
            await page.wait_for_timeout(200)
            ok("Botao '-' quantidade")
        except Exception as e:
            fail("Movimentacao", str(e))

        # ── PEDIDO — adicionar linha ────────────────────────────
        print("\n[PEDIDO — Modal]")
        try:
            await go_home(page)
            sol_btn = page.locator('[onclick*="Orders.openModal"]').first
            await sol_btn.scroll_into_view_if_needed()
            await sol_btn.click()
            await page.wait_for_selector("#modal-pedido.active", timeout=4000)
            linhas_antes = await page.locator('#order-items-list .order-item-row').count()
            await page.click('button[onclick*="addItemRow"]')
            await page.wait_for_timeout(300)
            linhas_dep = await page.locator('#order-items-list .order-item-row').count()
            ok("Botao 'Adicionar Item' — linha criada") if linhas_dep > linhas_antes else fail("Botao 'Adicionar Item'")
            await page.click('#modal-pedido .modal-close')
            await page.wait_for_timeout(300)
            ok("Fechar modal pedido")
        except Exception as e:
            fail("Pedido modal", str(e))

        # ── CONTAGEM ────────────────────────────────────────────
        print("\n[CONTAGEM]")
        try:
            await go_home(page)
            await page.evaluate("app.navigate('contagem-setup')")
            await page.wait_for_selector("#view-contagem-setup", state="visible", timeout=4000)
            ok("Abrir tela Contagem Setup")

            sel = page.locator('select').first
            if await sel.count():
                await sel.select_option(index=0)

            start_btn = page.locator('#btn-start-contagem')
            await start_btn.scroll_into_view_if_needed()
            await start_btn.click()
            await page.wait_for_selector("#view-contagem-act", state="visible", timeout=6000)
            ok("Botao 'Iniciar Contagem'")

            # Botoes +/- da lista de contagem
            plus_btns = page.locator('#view-contagem-act button[onclick*="updateCount(this, 1)"]')
            if await plus_btns.count() > 0:
                await plus_btns.first.click()
                await page.wait_for_timeout(200)
                ok("Botao '+' na lista de contagem")
            else:
                warn("Botao '+' contagem", "sem itens no estoque para testar")

            # Calculadora (se houver itens)
            calc_btns = page.locator('button[onclick*="openCalculator"]')
            if await calc_btns.count() > 0:
                await calc_btns.first.click()
                await page.wait_for_selector("#calc-modal.active", timeout=4000)
                ok("Calculadora — abre")
                await page.click('button[onclick*="calcAppend(\'5\')"]')
                await page.click('button[onclick*="calcAppend(\'+\')"]')
                await page.click('button[onclick*="calcAppend(\'3\')"]')
                await page.click('button[onclick*="calcEqual"]')
                display = await page.locator('#calc-display').inner_text()
                ok(f"Calculadora: 5+3 = {display.strip()}")
                await page.click('button[onclick*="calcClear"]')
                ok("Botao C (limpar calc)")
                await page.click('button[onclick*="closeCalculator"]')
                await page.wait_for_timeout(300)
                fechado = not await page.locator("#calc-modal.active").count()
                ok("Fechar calculadora") if fechado else fail("Fechar calculadora")
            else:
                warn("Calculadora", "sem itens para abrir")

            # Cancelar contagem
            await page.click('#btn-cancel-contagem')
            await page.wait_for_timeout(600)
            swal = page.locator('.swal2-confirm')
            if await swal.count():
                await swal.click()
                await page.wait_for_timeout(500)
            ok("Botao 'Cancelar Contagem'")
        except Exception as e:
            fail("Contagem", str(e))

        # ── LOGOUT ──────────────────────────────────────────────
        print("\n[LOGOUT]")
        try:
            await go_home(page)
            logout_btn = page.locator('#btn-logout')
            await logout_btn.scroll_into_view_if_needed()
            await logout_btn.click()
            await page.wait_for_timeout(600)
            swal = page.locator('.swal2-confirm')
            if await swal.count():
                await swal.click()
                await page.wait_for_timeout(500)
            login_visivel = await page.locator("#view-login").is_visible()
            ok("Botao Logout — volta para login") if login_visivel else fail("Botao Logout — nao voltou para login")
        except Exception as e:
            fail("Botao Logout", str(e))

        await browser.close()

        # ── RESULTADO FINAL ─────────────────────────────────────
        print("\n" + "=" * 55)
        total  = len(results)
        passed = sum(1 for r in results if r[0] == "OK")
        failed = sum(1 for r in results if r[0] == "FAIL")
        warned = sum(1 for r in results if r[0] == "WARN")
        print(f"  RESULTADO: {passed}/{total} OK  |  {failed} FAIL  |  {warned} WARN")
        print("=" * 55)

        if failed:
            print("\nFALHAS DETALHADAS:")
            for r in results:
                if r[0] == "FAIL":
                    print(f"  - {r[1]}" + (f": {r[2][:120]}" if r[2] else ""))

        if js_errs:
            unique = list(dict.fromkeys(js_errs))
            print(f"\nERROS JS NO BROWSER ({len(unique)} unicos):")
            for e in unique[:10]:
                print(f"  • {e[:120]}")

asyncio.run(main())
