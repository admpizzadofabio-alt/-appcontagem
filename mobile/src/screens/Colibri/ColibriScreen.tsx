import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Pressable, ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import {
  useColibriStatusQuery,
  useListarMapeamentosQuery,
  useCriarMapeamentoMutation,
  useRemoverMapeamentoMutation,
  useImportarVendasMutation,
  useListarImportacoesQuery,
  useListarCatalogoQuery,
  useSincronizarCatalogoMutation,
  useRemoverCatalogoItemMutation,
  useImportarProdutosColibriMutation,
  useMarcarColibriVistoMutation,
  type ColibriCatalogoItem,
} from '../../services/api/colibri'
import { useListarProdutosQuery } from '../../services/api/produtos'
import { SectionHeader } from '../../components/SectionHeader'
import { Card } from '../../components/Card'
import { ActionButton } from '../../components/ActionButton'
import { EmptyState } from '../../components/EmptyState'
import { colors } from '../../theme/colors'

type Aba = 'importar' | 'catalogo' | 'mapeamentos' | 'historico' | 'produtos'


function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function ontem() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function ColibriScreen() {
  const [aba, setAba] = useState<Aba>('catalogo')

  const ABAS: { key: Aba; label: string }[] = [
    { key: 'produtos',    label: '📦 Produtos' },
    { key: 'catalogo',    label: 'Catálogo' },
    { key: 'importar',    label: 'Importar' },
    { key: 'mapeamentos', label: 'Vínculos' },
    { key: 'historico',   label: 'Histórico' },
  ]

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <View style={s.abas}>
        {ABAS.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[s.abaBtn, aba === a.key && s.abaBtnAtiva]}
            onPress={() => setAba(a.key)}
          >
            <Text style={[s.abaLabel, aba === a.key && s.abaLabelAtiva]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {aba === 'produtos'    && <AbaProdutos />}
      {aba === 'catalogo'    && <AbaCatalogo />}
      {aba === 'importar'    && <AbaImportar />}
      {aba === 'mapeamentos' && <AbaMapeamentos />}
      {aba === 'historico'   && <AbaHistorico />}
    </SafeAreaView>
  )
}

// ──────────────────────────────
// Aba Importar Produtos — Checklist
// ──────────────────────────────
function AbaProdutos() {
  const { data: catalogo = [], isLoading: carregando } = useListarCatalogoQuery()
  const [sincronizar, { isLoading: sincronizando }] = useSincronizarCatalogoMutation()
  const [importar, { isLoading: importando }] = useImportarProdutosColibriMutation()
  const [marcarVisto] = useMarcarColibriVistoMutation()

  // Ao abrir esta aba, marca todos os itens não vistos como vistos → limpa o badge
  useEffect(() => { marcarVisto() }, [])

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const disponiveis = catalogo.filter((i) => !i.mapeado)
  const todosMarcados = disponiveis.length > 0 && selecionados.size === disponiveis.length

  function toggleItem(code: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleTodos() {
    if (todosMarcados) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(disponiveis.map((i) => i.colibriCode)))
    }
  }

  async function handleSincronizar() {
    try {
      const res = await sincronizar().unwrap()
      setSelecionados(new Set())
      Alert.alert('Sincronizado', `${res.total} produtos encontrados · ${res.novos} novos`)
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao sincronizar')
    }
  }

  async function handleImportar() {
    if (selecionados.size === 0) {
      Alert.alert('Atenção', 'Marque pelo menos um produto para importar.')
      return
    }
    Alert.alert(
      'Confirmar importação',
      `Importar ${selecionados.size} produto(s) selecionado(s)?\n\nDepois acesse Produtos para ajustar nome, custo e setor de cada um.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async () => {
            try {
              const res = await importar({ colibriCodes: Array.from(selecionados) }).unwrap()
              setSelecionados(new Set())
              Alert.alert('✅ Concluído', `${res.criados} produto(s) importado(s)`)
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao importar produtos')
            }
          },
        },
      ],
    )
  }

  // Agrupa por categoria para facilitar a leitura
  const grupos = Array.from(new Set(disponiveis.map((i) => i.grupo))).sort()

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Cabeçalho + Sincronizar */}
        <View style={s.syncRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.syncTitle}>Produtos disponíveis</Text>
            <Text style={s.syncSub}>{disponiveis.length} aguardando importação</Text>
          </View>
          <TouchableOpacity style={[s.syncBtn, sincronizando && { opacity: 0.6 }]} onPress={handleSincronizar} disabled={sincronizando}>
            {sincronizando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.syncBtnTxt}>🔄 Sincronizar</Text>}
          </TouchableOpacity>
        </View>

        {carregando && <EmptyState icon="⏳" title="Carregando catálogo..." />}

        {!carregando && catalogo.length === 0 && (
          <EmptyState icon="🔄" title="Catálogo vazio" subtitle="Toque em Sincronizar para buscar os produtos do Colibri" />
        )}

        {!carregando && catalogo.length > 0 && disponiveis.length === 0 && (
          <EmptyState icon="✅" title="Todos os produtos já importados" subtitle="Sincronize para verificar se há novidades no Colibri" />
        )}

        {disponiveis.length > 0 && (
          <>
            {/* Selecionar / desmarcar todos */}
            <TouchableOpacity style={s.selecionarTodosRow} onPress={toggleTodos}>
              <View style={[s.checkbox, todosMarcados && s.checkboxOn]}>
                {todosMarcados && <Text style={s.checkboxTick}>✓</Text>}
              </View>
              <Text style={s.selecionarTodosTxt}>
                {todosMarcados ? 'Desmarcar todos' : 'Selecionar todos'} ({disponiveis.length})
              </Text>
            </TouchableOpacity>

            {/* Lista agrupada por categoria */}
            {grupos.map((grupo) => {
              const itens = disponiveis.filter((i) => i.grupo === grupo)
              return (
                <View key={grupo}>
                  <SectionHeader title={grupo} />
                  {itens.map((item) => {
                    const marcado = selecionados.has(item.colibriCode)
                    return (
                      <TouchableOpacity key={item.colibriCode} style={s.checkItem} onPress={() => toggleItem(item.colibriCode)}>
                        <View style={[s.checkbox, marcado && s.checkboxOn]}>
                          {marcado && <Text style={s.checkboxTick}>✓</Text>}
                        </View>
                        <View style={s.checkItemInfo}>
                          <Text style={s.checkItemNome}>{item.colibriNome}</Text>
                          <Text style={s.checkItemSub}>Cód: {item.colibriCode}</Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Botão fixo na base — aparece só quando há seleção */}
      {selecionados.size > 0 && (
        <View style={s.importarBar}>
          <TouchableOpacity
            style={[s.importarBtn, importando && { opacity: 0.7 }]}
            onPress={handleImportar}
            disabled={importando}
          >
            {importando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.importarBtnTxt}>📥 Importar {selecionados.size} produto(s)</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ───────────────────────��──────
// Aba Catálogo
// ──────────────────────────────
function AbaCatalogo() {
  const { data: catalogo = [], isLoading, refetch } = useListarCatalogoQuery()
  const { data: produtos = [] } = useListarProdutosQuery()
  const [sincronizar, { isLoading: sincronizando }] = useSincronizarCatalogoMutation()
  const [removerItem] = useRemoverCatalogoItemMutation()
  const [criar] = useCriarMapeamentoMutation()

  const [filtroGrupo, setFiltroGrupo] = useState<string>('Todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'mapeado' | 'nao_mapeado'>('todos')
  const [modalItem, setModalItem] = useState<ColibriCatalogoItem | null>(null)
  const [produtoId, setProdutoId] = useState('')
  const [fatorConv, setFatorConv] = useState('1')

  const grupos = ['Todos', ...Array.from(new Set(catalogo.map((i) => i.grupo))).sort()]

  const filtrado = catalogo.filter((i) => {
    const grupoOk = filtroGrupo === 'Todos' || i.grupo === filtroGrupo
    const statusOk =
      filtroStatus === 'todos' ||
      (filtroStatus === 'mapeado' && i.mapeado) ||
      (filtroStatus === 'nao_mapeado' && !i.mapeado)
    return grupoOk && statusOk
  })

  const totalNaoMapeados = catalogo.filter((i) => !i.mapeado).length

  async function handleSincronizar() {
    try {
      const res = await sincronizar().unwrap()
      Alert.alert(
        'Sincronização concluída',
        `Total: ${res.total} produtos\nNovos: ${res.novos}\nAtualizados: ${res.atualizados}`,
      )
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao sincronizar catálogo')
    }
  }

  function handleRemover(id: string, nome: string) {
    Alert.alert('Remover do catálogo', `Remover "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removerItem(id) },
    ])
  }

  function abrirVincular(item: ColibriCatalogoItem) {
    setModalItem(item)
    setProdutoId('')
    setFatorConv('1')
  }

  async function confirmarVincular() {
    if (!modalItem || !produtoId) {
      Alert.alert('Atenção', 'Selecione um produto do estoque.')
      return
    }
    try {
      await criar({
        colibriCode: modalItem.colibriCode,
        colibriNome: modalItem.colibriNome,
        produtoId,
        fatorConv: parseFloat(fatorConv) || 1,
      }).unwrap()
      setModalItem(null)
      refetch()
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao criar vínculo')
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Botão sincronizar */}
        <View style={s.syncRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.syncTitle}>Produtos do Colibri POS</Text>
            <Text style={s.syncSub}>
              {catalogo.length} no catálogo · {totalNaoMapeados} sem vínculo
            </Text>
          </View>
          <TouchableOpacity
            style={[s.syncBtn, sincronizando && { opacity: 0.6 }]}
            onPress={handleSincronizar}
            disabled={sincronizando}
          >
            {sincronizando
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.syncBtnTxt}>🔄 Sincronizar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtroScroll}>
          {grupos.map((g) => (
            <TouchableOpacity
              key={g}
              style={[s.filtroBtn, filtroGrupo === g && s.filtroBtnAtivo]}
              onPress={() => setFiltroGrupo(g)}
            >
              <Text style={[s.filtroBtnTxt, filtroGrupo === g && s.filtroBtnTxtAtivo]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.statusFiltroRow}>
          {([['todos', 'Todos'], ['mapeado', 'Vinculados'], ['nao_mapeado', 'Sem vínculo']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.statusFiltroBtn, filtroStatus === key && s.statusFiltroBtnAtivo]}
              onPress={() => setFiltroStatus(key)}
            >
              <Text style={[s.statusFiltroBtnTxt, filtroStatus === key && s.statusFiltroBtnTxtAtivo]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && catalogo.length === 0 && (
          <EmptyState
            icon="🔄"
            title="Catálogo vazio"
            subtitle="Toque em Sincronizar para carregar os produtos do Colibri POS"
          />
        )}

        {filtrado.map((item) => (
          <Card key={item.id} style={s.catalogoCard}>
            <View style={s.catalogoRow}>
              <View style={[s.catalogoBadge, item.mapeado ? s.catalogoBadgeOk : s.catalogoBadgePendente]}>
                <Text style={s.catalogoBadgeTxt}>{item.mapeado ? '✓' : '!'}</Text>
              </View>
              <View style={s.catalogoInfo}>
                <Text style={s.catalogoNome}>{item.colibriNome}</Text>
                <Text style={s.catalogoGrupo}>{item.grupo} · Cód: {item.colibriCode}</Text>
                {item.mapeado && (
                  <Text style={s.catalogoVinculo}>→ {item.produtoNome}</Text>
                )}
              </View>
              <View style={s.catalogoAcoes}>
                {!item.mapeado && (
                  <TouchableOpacity style={s.vincularBtn} onPress={() => abrirVincular(item)}>
                    <Text style={s.vincularBtnTxt}>Vincular</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemover(item.id, item.colibriNome)} style={s.removeBtn}>
                  <Text style={s.removeBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Modal de vínculo */}
      <Modal visible={modalItem !== null} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Vincular ao estoque</Text>
            <Text style={s.modalSub}>{modalItem?.colibriNome}</Text>

            <Text style={s.fieldLabel}>Produto no estoque *</Text>
            <ScrollView style={s.produtoLista} nestedScrollEnabled>
              {(produtos as any[]).filter((p) => p.ativo).map((p) => (
                <Pressable
                  key={p.id}
                  style={[s.produtoItem, produtoId === p.id && s.produtoItemSelecionado]}
                  onPress={() => setProdutoId(p.id)}
                >
                  <Text style={[s.produtoItemTxt, produtoId === p.id && s.produtoItemTxtSelecionado]}>
                    {p.nomeBebida}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Fator de conversão</Text>
            <TextInput
              style={s.input}
              value={fatorConv}
              onChangeText={setFatorConv}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={s.hint}>1 unidade Colibri = fator × unidades no estoque</Text>

            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setModalItem(null)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.btnConfirmar} onPress={confirmarVincular}>
                <Text style={s.btnConfirmarTxt}>Vincular</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ──────────────────────────────
// Aba Importar
// ──────────────────────────────
function AbaImportar() {
  const { data: status } = useColibriStatusQuery()
  const [importar, { isLoading }] = useImportarVendasMutation()
  const [dataInicio, setDataInicio] = useState(ontem())
  const [dataFim, setDataFim] = useState(hoje())
  const [local, setLocal] = useState<'Bar' | 'Delivery'>('Bar')

  async function handleImportar() {
    if (!status?.ok) {
      Alert.alert('Colibri desconectado', 'Verifique as credenciais nas configurações do servidor.')
      return
    }
    Alert.alert(
      'Confirmar importação',
      `Importar vendas de ${dataInicio} a ${dataFim} e descontar do estoque ${local}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async () => {
            try {
              const res = await importar({ dataInicio, dataFim, local }).unwrap()
              const msg = [
                `Vendas processadas: ${res.totalVendas}`,
                `Produtos baixados: ${res.totalImportados}`,
                `Itens sem vínculo: ${res.totalIgnorados}`,
                res.erros.length > 0 ? `\nErros: ${res.erros.join(', ')}` : '',
              ].filter(Boolean).join('\n')
              Alert.alert('Importação concluída', msg)
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Falha ao importar')
            }
          },
        },
      ],
    )
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Card style={s.statusCard}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: status?.ok ? colors.success : colors.danger }]} />
          <Text style={s.statusTxt}>{status?.mensagem ?? 'Verificando conexão...'}</Text>
        </View>
      </Card>

      <SectionHeader title="Período das vendas" />

      <Card>
        <Text style={s.fieldLabel}>Data início</Text>
        <TextInput
          style={s.input}
          value={dataInicio}
          onChangeText={setDataInicio}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <Text style={[s.fieldLabel, { marginTop: 12 }]}>Data fim</Text>
        <TextInput
          style={s.input}
          value={dataFim}
          onChangeText={setDataFim}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />

        <Text style={[s.fieldLabel, { marginTop: 12 }]}>Descontar do estoque</Text>
        <View style={s.localRow}>
          {(['Bar', 'Delivery'] as const).map((l) => (
            <TouchableOpacity
              key={l}
              style={[s.localBtn, local === l && s.localBtnAtivo]}
              onPress={() => setLocal(l)}
            >
              <Text style={[s.localBtnTxt, local === l && s.localBtnTxtAtivo]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <ActionButton
        label={isLoading ? 'Importando...' : 'Importar vendas do Colibri'}
        onPress={handleImportar}
        disabled={isLoading}
        style={{ marginTop: 8 }}
      />

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}

      <Card style={s.infoCard}>
        <Text style={s.infoTitle}>Como funciona</Text>
        <Text style={s.infoTxt}>1. Busca todas as vendas do período no Colibri POS</Text>
        <Text style={s.infoTxt}>2. Cada item é cruzado com os vínculos do catálogo</Text>
        <Text style={s.infoTxt}>3. Uma saída é registrada automaticamente no estoque</Text>
        <Text style={s.infoTxt}>4. Itens sem vínculo são ignorados (configure em Catálogo)</Text>
      </Card>
    </ScrollView>
  )
}

// ──────────────────────────────
// Aba Vínculos (mapeamentos)
// ──────────────────────────────
function AbaMapeamentos() {
  const { data: mapeamentos = [], isLoading } = useListarMapeamentosQuery()
  const { data: produtos = [] } = useListarProdutosQuery()
  const [criar] = useCriarMapeamentoMutation()
  const [remover] = useRemoverMapeamentoMutation()
  const [modalAberto, setModalAberto] = useState(false)
  const [colibriCode, setColibriCode] = useState('')
  const [colibriNome, setColibriNome] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [fatorConv, setFatorConv] = useState('1')

  async function handleCriar() {
    if (!colibriCode.trim() || !colibriNome.trim() || !produtoId) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.')
      return
    }
    try {
      await criar({
        colibriCode: colibriCode.trim(),
        colibriNome: colibriNome.trim(),
        produtoId,
        fatorConv: parseFloat(fatorConv) || 1,
      }).unwrap()
      setModalAberto(false)
      setColibriCode('')
      setColibriNome('')
      setProdutoId('')
      setFatorConv('1')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Falha ao criar vínculo')
    }
  }

  function handleRemover(id: string, nome: string) {
    Alert.alert('Remover vínculo', `Remover vínculo de "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => remover(id) },
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <ActionButton label="Novo vínculo manual" onPress={() => setModalAberto(true)} style={{ marginBottom: 4 }} />

        {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
        {!isLoading && mapeamentos.length === 0 && (
          <EmptyState
            icon="🔗"
            title="Nenhum vínculo"
            subtitle="Use a aba Catálogo para vincular produtos do Colibri ao estoque"
          />
        )}

        {mapeamentos.map((m) => (
          <Card key={m.id} style={s.mapeamentoCard}>
            <View style={s.mapeamentoRow}>
              <View style={s.mapeamentoInfo}>
                <Text style={s.mapeamentoColibri}>{m.colibriNome}</Text>
                <Text style={s.mapeamentoCodigo}>Cód: {m.colibriCode}</Text>
                <Text style={s.mapeamentoProduto}>→ {m.produto.nomeBebida}</Text>
                {m.fatorConv !== 1 && (
                  <Text style={s.mapeamentoFator}>Fator: ×{m.fatorConv}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleRemover(m.id, m.colibriNome)} style={s.removeBtn}>
                <Text style={s.removeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={modalAberto} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo vínculo manual</Text>

            <Text style={s.fieldLabel}>Código no Colibri *</Text>
            <TextInput
              style={s.input}
              value={colibriCode}
              onChangeText={setColibriCode}
              placeholder="Ex.: HEIN330"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text style={s.fieldLabel}>Nome no Colibri *</Text>
            <TextInput
              style={s.input}
              value={colibriNome}
              onChangeText={setColibriNome}
              placeholder="Ex.: Heineken 330ml"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={s.fieldLabel}>Produto no estoque *</Text>
            <ScrollView style={s.produtoLista} nestedScrollEnabled>
              {(produtos as any[]).filter((p) => p.ativo).map((p) => (
                <Pressable
                  key={p.id}
                  style={[s.produtoItem, produtoId === p.id && s.produtoItemSelecionado]}
                  onPress={() => setProdutoId(p.id)}
                >
                  <Text style={[s.produtoItemTxt, produtoId === p.id && s.produtoItemTxtSelecionado]}>
                    {p.nomeBebida}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Fator de conversão</Text>
            <TextInput
              style={s.input}
              value={fatorConv}
              onChangeText={setFatorConv}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={s.hint}>1 unidade Colibri = fator × unidades no estoque</Text>

            <View style={s.modalAcoes}>
              <Pressable style={s.btnCancelar} onPress={() => setModalAberto(false)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.btnConfirmar} onPress={handleCriar}>
                <Text style={s.btnConfirmarTxt}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ──────────────────────────────
// Aba Histórico
// ──────────────────────────────
function AbaHistorico() {
  const { data: importacoes = [], isLoading } = useListarImportacoesQuery()

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {isLoading && <EmptyState icon="⏳" title="Carregando..." />}
      {!isLoading && importacoes.length === 0 && (
        <EmptyState icon="📋" title="Nenhuma importação" subtitle="O histórico aparecerá após a primeira importação" />
      )}

      {importacoes.map((imp) => (
        <Card key={imp.id} style={StyleSheet.flatten([s.histCard, imp.status === 'ok' ? s.histCardOk : s.histCardWarn]) as ViewStyle}>
          <Text style={s.histPeriodo}>
            {imp.dataInicio.slice(0, 10)} → {imp.dataFim.slice(0, 10)}
          </Text>
          <Text style={s.histData}>
            {new Date(imp.importadoEm).toLocaleString('pt-BR')} · {imp.usuarioNome}
          </Text>
          <View style={s.histStats}>
            <View style={s.histStat}>
              <Text style={s.histStatNum}>{imp.totalVendas}</Text>
              <Text style={s.histStatLabel}>vendas</Text>
            </View>
            <View style={s.histStat}>
              <Text style={[s.histStatNum, { color: colors.success }]}>{imp.totalImportados}</Text>
              <Text style={s.histStatLabel}>baixados</Text>
            </View>
            <View style={s.histStat}>
              <Text style={[s.histStatNum, { color: colors.textSub }]}>{imp.totalIgnorados}</Text>
              <Text style={s.histStatLabel}>ignorados</Text>
            </View>
          </View>
          {imp.status !== 'ok' && (
            <Text style={s.histErro}>Parcial — verifique vínculos no catálogo</Text>
          )}
        </Card>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },

  abas: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  abaBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  abaBtnAtiva: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  abaLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  abaLabelAtiva: { color: colors.primary },

  // Catálogo
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  syncTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  syncSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  syncBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  syncBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  filtroScroll: { flexGrow: 0, marginBottom: -4 },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.surface },
  filtroBtnAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  filtroBtnTxt: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  filtroBtnTxtAtivo: { color: '#fff' },

  statusFiltroRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statusFiltroBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface },
  statusFiltroBtnAtivo: { backgroundColor: colors.accentLight, borderColor: colors.primary },
  statusFiltroBtnTxt: { fontSize: 11, fontWeight: '600', color: colors.textSub },
  statusFiltroBtnTxtAtivo: { color: colors.primary },

  catalogoCard: { padding: 12 },
  catalogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catalogoBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catalogoBadgeOk: { backgroundColor: colors.successLight },
  catalogoBadgePendente: { backgroundColor: colors.warningLight },
  catalogoBadgeTxt: { fontSize: 13, fontWeight: '800' },
  catalogoInfo: { flex: 1, gap: 2 },
  catalogoNome: { fontSize: 13, fontWeight: '700', color: colors.text },
  catalogoGrupo: { fontSize: 11, color: colors.textMuted },
  catalogoVinculo: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  catalogoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vincularBtn: { backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  vincularBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Importar
  statusCard: { flexDirection: 'row' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTxt: { fontSize: 13, color: colors.text, flex: 1 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.surfaceAlt,
  },
  localRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  localBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surfaceAlt },
  localBtnAtivo: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  localBtnTxt: { fontSize: 14, fontWeight: '600', color: colors.textSub },
  localBtnTxtAtivo: { color: colors.primary },

  infoCard: { backgroundColor: colors.infoLight, gap: 6 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.info, marginBottom: 2 },
  infoTxt: { fontSize: 12, color: colors.info, lineHeight: 18 },

  // Vínculos
  mapeamentoCard: { padding: 14 },
  mapeamentoRow: { flexDirection: 'row', alignItems: 'center' },
  mapeamentoInfo: { flex: 1, gap: 2 },
  mapeamentoColibri: { fontSize: 14, fontWeight: '700', color: colors.text },
  mapeamentoCodigo: { fontSize: 11, color: colors.textMuted },
  mapeamentoProduto: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  mapeamentoFator: { fontSize: 11, color: colors.warning },
  removeBtn: { padding: 8 },
  removeBtnTxt: { fontSize: 16, color: colors.danger, fontWeight: '700' },

  // Modal compartilhado
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  modalSub: { fontSize: 13, color: colors.textSub, marginBottom: 4 },
  produtoLista: { maxHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 4 },
  produtoItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  produtoItemSelecionado: { backgroundColor: colors.accentLight },
  produtoItemTxt: { fontSize: 13, color: colors.text },
  produtoItemTxtSelecionado: { color: colors.primary, fontWeight: '700' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: -4 },

  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  btnCancelarTxt: { fontSize: 14, fontWeight: '700', color: colors.textSub },
  btnConfirmar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  btnConfirmarTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Histórico
  histCard: { borderLeftWidth: 4 },
  histCardOk: { borderLeftColor: colors.success },
  histCardWarn: { borderLeftColor: colors.warning },
  histPeriodo: { fontSize: 14, fontWeight: '700', color: colors.text },
  histData: { fontSize: 11, color: colors.textSub },
  histStats: { flexDirection: 'row', gap: 20, marginTop: 8 },
  histStat: { alignItems: 'center' },
  histStatNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  histStatLabel: { fontSize: 11, color: colors.textSub },
  histErro: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  // Checklist de importação
  selecionarTodosRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  selecionarTodosTxt: { fontSize: 14, fontWeight: '700', color: colors.text },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  checkItemInfo: { flex: 1 },
  checkItemNome: { fontSize: 14, fontWeight: '600', color: colors.text },
  checkItemSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { fontSize: 13, fontWeight: '800', color: '#fff' },
  importarBar: { padding: 16, paddingBottom: 24, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  importarBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  importarBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
})
