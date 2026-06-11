import { getErrorMessage, sfApi } from '../../../services/electronApiClient'

export function useSfShipmentActions({
  busy,
  form,
  currentShipment,
  deliveryEstimate,
  shipments,
  pendingOrders,
  batchDrawerOpen,
  batchSelectedIds,
  batchResults,
  batchLoading,
  selectedDetail,
  detailDialogOpen,
  actualPaidForm,
  filters,
  isIntraCity,
  quoteResult,
  monthlyCardConfigured,
  pendingSelectableOrders,
  allPendingSelected,
  confirmDialog,
  payload,
  notify,
  productLabel,
  senderAddrText,
  receiverAddrText,
  feeLabel,
  statusLabel,
  canPlaceOrder,
  localDateText,
  resetCreateFormAfterSubmit,
}) {
  async function saveDraft(silent = false) {
    busy.value = true
    try {
      const shipment = await sfApi.saveShipmentDraft(payload())
      currentShipment.value = shipment
      form.id = shipment.id
      if (!silent) notify('success', `草稿已保存：${shipment.shipment_no}`)
      await loadShipments()
      return shipment
    } catch (error) {
      notify('error', `保存失败：${getErrorMessage(error)}`)
      return null
    } finally {
      busy.value = false
    }
  }

  async function precheck() {
    const shipment = await saveDraft(true)
    if (!shipment) return
    busy.value = true
    try {
      const result = isIntraCity.value
        ? await sfApi.quoteIntraCity({ shipmentId: shipment.id })
        : await sfApi.precheckShipment({ shipmentId: shipment.id })
      currentShipment.value = result.shipment || shipment
      notify(result.ok ? 'success' : 'error', result.ok ? '查询完成' : result.message)
      await loadShipments()
    } catch (error) {
      notify('error', getErrorMessage(error))
    } finally {
      busy.value = false
    }
  }

  async function placeOrder() {
    if (!canPlaceOrder.value) {
      notify('error', '请完善信息和取件时间')
      return
    }
    const summary = [
      `产品：${productLabel(form.productCode)}`,
      `${form.senderName} → ${form.receiverName}`,
      `${senderAddrText.value} → ${receiverAddrText.value}`,
      `取件：${form.plannedSendAt.replace('T', ' ')}`,
      `预计费用：${feeLabel(quoteResult.value?.estimatedFee ?? currentShipment.value?.estimated_fee)}`,
    ].join('\n')
    const ok = await confirmDialog({
      title: '确认提交顺丰订单',
      message: '成功后将产生真实顺丰运单和取件任务。',
      details: [summary, monthlyCardConfigured.value ? '月结优先' : '寄付现结'],
      confirmText: '提交下单',
      danger: true,
    })
    if (!ok) return
    busy.value = true
    try {
      const result = await sfApi.placeShipment(payload())
      currentShipment.value = result.shipment || currentShipment.value
      if (currentShipment.value) form.id = currentShipment.value.id
      deliveryEstimate.value = result.deliveryEstimate || null
      notify(
        result.ok && result.status === 'submitted' ? 'success' : 'error',
        result.ok && result.status === 'submitted'
          ? `下单成功！运单号：${result.trackingNo || '-'}`
          : result.message || `状态：${statusLabel(result.status)}`,
      )
      await Promise.all([loadShipments(), loadPendingShipmentOrders()])
      if (result.ok && result.status === 'submitted') resetCreateFormAfterSubmit()
    } catch (error) {
      notify('error', `下单失败：${getErrorMessage(error)}`)
    } finally {
      busy.value = false
    }
  }

  async function loadShipments() {
    shipments.value = await sfApi.listShipments({ status: filters.status || undefined })
  }

  async function loadPendingShipmentOrders() {
    batchLoading.value = true
    try {
      const result = await sfApi.listPendingShipmentOrders({ date: localDateText(), includeOverdue: false })
      pendingOrders.value = Array.isArray(result?.orders) ? result.orders : []
      const selectableIds = new Set(pendingOrders.value.filter((order) => order.selectable).map((order) => order.id))
      batchSelectedIds.value = batchSelectedIds.value.filter((id) => selectableIds.has(id))
    } catch (error) {
      notify('error', `加载失败：${getErrorMessage(error)}`)
    } finally {
      batchLoading.value = false
    }
  }

  function toggleSelectAllPending() {
    batchSelectedIds.value = allPendingSelected.value ? [] : pendingSelectableOrders.value.map((order) => order.id)
  }

  async function placeSelectedOrders() {
    if (!batchSelectedIds.value.length) {
      notify('error', '请勾选订单')
      return
    }
    const ok = await confirmDialog({
      title: '确认批量创建顺丰运单',
      message: `将对 ${batchSelectedIds.value.length} 个订单创建真实顺丰运单。`,
      details: ['成功后会产生真实寄件任务，请确认批量订单均可寄件。'],
      confirmText: '批量创建',
      danger: true,
    })
    if (!ok) return
    busy.value = true
    try {
      const result = await sfApi.batchPlaceShipments({ ...payload(), orderIds: batchSelectedIds.value })
      batchResults.value = Array.isArray(result?.results) ? result.results : []
      notify(
        result.failedCount ? 'error' : 'success',
        result.failedCount ? `成功${result.successCount || 0}，失败${result.failedCount}` : `全部成功${result.successCount || 0}单`,
      )
      batchSelectedIds.value = []
      await Promise.all([loadPendingShipmentOrders(), loadShipments()])
      if (!result.failedCount) batchDrawerOpen.value = false
      return result
    } catch (error) {
      notify('error', `批量寄件失败：${getErrorMessage(error)}`)
      return null
    } finally {
      busy.value = false
    }
  }

  async function openShipment(shipment) {
    selectedDetail.value = await sfApi.detail({ shipmentId: shipment.id })
    actualPaidForm.amount = selectedDetail.value?.actual_paid_fee ?? selectedDetail.value?.billed_fee ?? ''
    actualPaidForm.note = selectedDetail.value?.actual_paid_note || ''
    detailDialogOpen.value = true
  }

  async function recoverResult(id) {
    busy.value = true
    try {
      const result = await sfApi.recoverResult({ shipmentId: id })
      notify(result.ok ? 'success' : 'error', result.ok ? `运单号:${result.trackingNo || '-'}` : result.message)
      await loadShipments()
      await openShipment({ id })
    } finally {
      busy.value = false
    }
  }

  async function cancelShipment(id) {
    const ok = await confirmDialog({
      title: '取消顺丰订单',
      message: '确认取消这笔顺丰寄件订单？',
      details: ['如果顺丰侧已接收订单，该操作会尝试取消真实寄件任务。'],
      confirmText: '取消订单',
      danger: true,
    })
    if (!ok) return
    busy.value = true
    try {
      const result = await sfApi.cancelShipment({ shipmentId: id })
      notify(result.ok ? 'success' : 'error', result.ok ? '已取消' : result.message)
      await loadShipments()
      if (selectedDetail.value?.id === id) await openShipment({ id })
    } finally {
      busy.value = false
    }
  }

  async function refreshRoutes(id) {
    busy.value = true
    try {
      const result = await sfApi.queryRoutes({ shipmentId: id })
      notify(result.ok ? 'success' : 'error', result.ok ? '轨迹已刷新' : result.message)
      await loadShipments()
      await openShipment({ id })
    } finally {
      busy.value = false
    }
  }

  async function refreshFee(id) {
    busy.value = true
    try {
      const result = await sfApi.queryFee({ shipmentId: id })
      notify(result.ok ? 'success' : 'error', result.ok ? '运费已刷新' : result.message)
      await loadShipments()
      await openShipment({ id })
    } finally {
      busy.value = false
    }
  }

  async function saveActualPaid() {
    if (!selectedDetail.value?.id) return
    busy.value = true
    try {
      const result = await sfApi.updateActualPaid({
        shipmentId: selectedDetail.value.id,
        actualPaidFee: actualPaidForm.amount,
        note: actualPaidForm.note,
      })
      notify(result.ok ? 'success' : 'error', result.ok ? '已保存' : result.message)
      await loadShipments()
      await openShipment({ id: selectedDetail.value.id })
    } finally {
      busy.value = false
    }
  }

  return {
    saveDraft,
    precheck,
    placeOrder,
    loadShipments,
    loadPendingShipmentOrders,
    toggleSelectAllPending,
    placeSelectedOrders,
    openShipment,
    recoverResult,
    cancelShipment,
    refreshRoutes,
    refreshFee,
    saveActualPaid,
  }
}
