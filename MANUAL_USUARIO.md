# APPCONTAGEM — Manual do Usuário
### Pizza do Fábio · Controle de Estoque de Bebidas

**Versão:** 2.0  
**Última atualização:** Maio 2026

---

## Perfis de Acesso

O sistema tem três níveis. Cada um vê e faz coisas diferentes:

| Perfil | Quem é | O que pode fazer |
|---|---|---|
| **Operador** | Garçom, balconista | Abrir caixa, contar estoque, registrar entradas e perdas, erros de comanda |
| **Supervisor** | Gerente de turno | Tudo do Operador + aprovar/rejeitar perdas |
| **Admin** | Dono, gerente geral | Tudo + aprovar rascunhos, ver métricas anti-furto, gerenciar usuários e produtos |

---

## Login

1. Abra o aplicativo
2. Digite seu **PIN** (4 a 6 dígitos)
3. Ou use **biometria** (Face ID ou digital) se já configurada
4. Toque em **Entrar**

> Após 5 tentativas erradas a conta fica bloqueada temporariamente.

---

## Tela Inicial (Home)

Ao entrar você vê:

- **Olá, [seu nome]** — confirma que está logado corretamente
- **Resumo do Estoque** — valor total em estoque, alertas de produtos baixos e aprovações pendentes (Supervisor+)
- **Abrir Caixa** — botão em destaque para iniciar o turno
- **Ações Rápidas** — Entrada, Perda, Transferência
- **Gestão** — Pedidos de Compra, Relatórios, Aprovações Pendentes (Supervisor+)
- **Administração** — Usuários, Produtos (Admin)

---

## Fluxo do Turno (O mais importante)

### PASSO 1 — Abrir o Caixa

Sempre que chegar para trabalhar, a primeira coisa é abrir o caixa.

1. Na Home, toque em **🔓 Abrir Caixa**
2. Selecione o local: **Bar** ou **Delivery**
3. Toque em **Iniciar contagem do [local]**
4. O sistema cria a contagem automaticamente e abre a tela de contagem

> Se já houver um turno aberto (colega esqueceu de fechar ou você já abriu), o sistema mostra o botão **Continuar contagem** em vez de criar um novo.

---

### PASSO 2 — Fazer a Contagem

A contagem é **cega**: você não vê a quantidade que o sistema espera. Isso é proposital — você conta o que está físicamente na geladeira/prateleira sem influência.

**Como contar:**

1. Aparece o nome do produto na tela
2. Vá até o produto, conte a quantidade real
3. Digite a quantidade no campo grande
4. Toque em **Próximo ➡** para ir ao próximo produto
5. Use **⬅ Anterior** para voltar se errou
6. Os círculos numerados em baixo mostram o progresso — os verdes já foram contados

**Dicas:**
- Produtos já contados ficam com o valor salvo — você pode voltar e corrigir
- Você pode pular e voltar para qualquer produto pelos círculos numerados
- Ao terminar o último produto, o botão vira **Finalizar →** e vai para o resumo

---

### PASSO 3 — Resumo da Contagem

Depois de contar tudo, aparece o resumo com três categorias:

#### ✅ OK
Produto contado exatamente igual ao esperado. Nenhuma ação necessária.

#### 🟡 Divergências Leves
Pequena diferença (até 2 unidades ou 5% do esperado). O sistema **ajusta automaticamente** o estoque. Você não precisa fazer nada.

#### 🔴 Divergências Grandes
Diferença significativa. **Você precisa agir** antes de finalizar:

1. Toque no produto com divergência grande
2. Um painel abre na parte de baixo da tela

**Se o produto está faltando (diferença negativa):**
- Tire uma **foto** do local onde o produto deveria estar
- Digite uma **justificativa** (ex: "5 garrafas quebradas no estoque", "consumo interno registrado")
- Toque em **Salvar**

**Se o produto está sobrando (diferença positiva — tem mais do que o esperado):**
- Você tem duas opções:
  - **Justificar divergência:** mesma coisa, foto + justificativa
  - **Registrar entrada:** se a sobra veio de alguma compra que não foi lançada no sistema
    - Selecione "Registrar entrada"
    - Informe de onde veio (ex: "Compra sem nota do fornecedor X")
    - Tire a foto comprovante
    - Toque em **Criar rascunho** → O Admin vai receber para aprovar ou rejeitar

**Só é possível finalizar quando todas as divergências grandes tiverem foto e justificativa.**

#### Finalizando

Quando tudo estiver resolvido, toque em **Confirmar e abrir caixa**.

O sistema:
- Ajusta automaticamente os itens leves
- Registra as divergências grandes para o Admin
- Libera o turno para operação

---

### DURANTE O TURNO — Erro de Comanda

Acontece quando o garçom comanda "Coca Cola Lata" mas serve "Coca Cola Zero". Para registrar:

1. Na tela **Abrir Caixa** (enquanto o turno está aberto), toque em **📋 Erro de Comanda**
2. Busque e selecione o **produto que estava na comanda** (o errado)
3. Busque e selecione o **produto que foi realmente servido** (o certo)
4. Confirme a quantidade
5. Tire a **foto da comanda** como comprovante
6. Toque em **Registrar correção**

O sistema automaticamente desconta o produto correto do estoque e registra o erro para o Admin ver.

> **Por que isso importa?** Sem esse registro, o estoque de Coca Zero vai divergir na próxima contagem sem explicação. Com o registro, a correção explica a divergência.

---

## Registrar Entrada de Produto

Quando chega mercadoria (compra, devolução):

1. Na Home, toque em **📥 Entrada**
2. Selecione o produto
3. Informe a quantidade
4. Selecione o local (Bar ou Delivery)
5. Adicione observação se necessário
6. Toque em **Registrar**

**Atenção — Anti-Duplicação:**

O sistema verifica as últimas 24 horas. Se detectar entrada do mesmo produto:

- **Aviso:** mostra as entradas recentes — você decide se confirma ou cancela
- **Bloqueio:** se a quantidade for idêntica a uma entrada já registrada, o sistema **não deixa registrar**. Isso evita lançar a mesma nota duas vezes.

---

## Registrar Perda

Quando um produto é quebrado, vencido ou descartado:

1. Na Home, toque em **🗑️ Perda**
2. Selecione o produto e a quantidade
3. Informe o motivo
4. Toque em **Registrar**

Se a quantidade for grande (acima do limite configurado):
- A perda fica **pendente de aprovação**
- Um Supervisor ou Admin precisa aprovar antes do estoque ser descontado
- Você recebe confirmação quando for aprovada ou rejeitada

---

## Transferência entre Bar e Delivery

Quando precisa mover produto de um local para outro:

1. Na Home, toque em **🔄 Transferência**
2. Selecione: **origem** (Bar ou Delivery) e **destino**
3. Selecione o produto e a quantidade
4. Toque em **Transferir**

O estoque é descontado de um lado e acrescido no outro imediatamente.

---

## Pedidos de Compra

Para solicitar compra de um produto que está acabando:

1. Na Home, toque em **Gestão → 🛒 Pedidos de Compra**
2. Toque em **Novo Pedido**
3. Informe o produto, quantidade e urgência
4. Toque em **Enviar**

O Admin pode editar ou excluir pedidos e marcar como atendido quando o produto chegar.

---

## Relatórios

1. Na Home, toque em **Gestão → 📈 Relatórios**
2. Selecione o período
3. Veja os KPIs: valor de estoque, perdas, divergências, entradas

---

## Para Supervisores e Admins — Painel de Aprovações

### Aprovar ou Rejeitar Perdas

1. Na Home, toque em **Gestão → ✅ Aprovações Pendentes**  
   ou acesse **Painel Admin** diretamente
2. Vá para a aba **Perdas**
3. Veja o produto, quantidade e motivo informado pelo operador
4. Toque em **Aprovar** ou **Rejeitar** (com motivo)

---

## Para Admins — Painel Anti-Furto

Acesse pela Home → **Gestão → ✅ Aprovações Pendentes** (ou **Painel Admin**).

O painel tem 4 abas:

### Aba Rascunhos
Sobras detectadas na contagem que precisam de decisão:

- **Aprovar:** confirma que a entrada é legítima → o estoque é acrescido automaticamente
- **Rejeitar:** descarta o rascunho (com motivo) → a sobra fica como divergência não explicada

### Aba Perdas
Aprovações de perdas grandes registradas pelos operadores.

### Aba Correções
Lista de todos os erros de comanda registrados, com foto comprovante. Use para:
- Verificar se os erros são genuínos
- Cruzar com divergências de contagem
- Identificar operadores com muitos erros

### Aba Métricas
Visão geral dos últimos 14 dias:
- **Rascunhos pendentes** — quantas sobras ainda precisam de decisão
- **Correções registradas** — total de erros de comanda no período
- **Por operador** — quantos turnos, divergências grandes e valor do gap por pessoa
- **Histórico de turnos** — todos os turnos com status, divergências e valor

> Turnos com borda vermelha e marcação "Sem contagem" são alertas: o caixa foi fechado automaticamente sem que a contagem tenha sido feita.

---

## Para Admins — Gerenciar Usuários

1. Home → **Administração → 👥 Usuários**
2. Toque em **+ Novo** para criar
3. Preencha: nome, PIN, setor, nível de acesso
4. Para editar: toque no usuário da lista
5. Para desativar: toque no usuário → **Desativar**

---

## Para Admins — Gerenciar Produtos

1. Home → **Administração → 🍺 Produtos**
2. Toque em **+ Novo** para criar
3. Preencha: nome, categoria, unidade de medida, custo unitário, estoque mínimo
4. Para editar: toque no produto
5. Para excluir: só é possível excluir definitivamente produtos sem histórico de movimentação

---

## Para Admins — Integração Colibri POS

> **Em desenvolvimento.** Esta funcionalidade ainda não está disponível no app. Quando liberada, permitirá sincronizar o catálogo de bebidas do Colibri POS e importar vendas automaticamente como saídas de estoque.

---

## Aba Requisições

A aba **Requisições** aparece no menu inferior do app e está **em desenvolvimento**. Em breve permitirá receber e gerenciar solicitações de estoque vindas de outros setores. Por enquanto não possui funcionalidade ativa.

---

## Dúvidas Frequentes

**P: Posso abrir dois caixas ao mesmo tempo?**  
R: Não. Cada local (Bar / Delivery) só pode ter um turno aberto por vez. Se tentar abrir novamente, o sistema mostra o turno já aberto.

**P: O que acontece se eu não fizer a contagem?**  
R: O sistema fecha o turno automaticamente às 04:00. O turno fica marcado como "fechado sem contagem" e aparece como alerta para o Admin.

**P: Posso corrigir uma contagem depois de finalizar?**  
R: Não. Após finalizar, a contagem está fechada. Para corrigir o estoque use uma Entrada ou Perda manualmente.

**P: O que é um rascunho de entrada?**  
R: É quando você conta um produto e encontra mais do que o esperado. Você cria um rascunho explicando de onde veio o excesso. O Admin decide se aprova (entrada vai pro estoque) ou rejeita.

**P: Por que minha entrada foi bloqueada?**  
R: O sistema encontrou uma entrada do mesmo produto com a mesma quantidade nas últimas 24 horas. Isso evita lançar a mesma nota fiscal duas vezes. Se for uma entrada diferente, confirme mesmo assim.

**P: Posso usar o app offline?**  
R: Não. O app precisa de conexão com o servidor para funcionar. Certifique-se de estar na mesma rede Wi-Fi do servidor.

---

## Contato e Suporte

Em caso de problemas técnicos, entre em contato com o administrador do sistema.
