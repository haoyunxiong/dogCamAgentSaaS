function valueOf(maybeRef) {
  return maybeRef && typeof maybeRef === 'object' && 'value' in maybeRef
    ? maybeRef.value
    : maybeRef
}

export function useOrderActions(deps) {
  function primaryActionLabel(order) {
    if (deps.isPendingShipOrder(order)) return '去发货'
    if (deps.isPendingReturnOrder(order) || deps.isOverdueOrder(order)) return '确认归还'
    if (deps.isActiveOrder(order) || order?.order_status === 'shipping') return '续租/延期'
    if (deps.isFinishedOrder(order)) return '查看'
    return '查看'
  }

  function isPrimaryActionDisabled(order) {
    return primaryActionLabel(order) === '去发货' && valueOf(deps.shipActionLoading)
  }

  async function runPrimaryAction(order) {
    const label = primaryActionLabel(order)
    if (label === '去发货') {
      await deps.openDetailModal(order)
      return
    }
    if (label === '确认归还') {
      await deps.markReturned(order.id)
      return
    }
    if (label === '续租/延期') {
      deps.openExtendModal(order)
      return
    }
    await deps.openDetailModal(order)
  }

  function actionMenuItems() {
    return [
      { key: 'detail', label: '详情' },
      { key: 'edit', label: '编辑' },
      { key: 'ship', label: '寄件', disabled: valueOf(deps.shipActionLoading) },
      { key: 'copy', label: '复制订单号' },
      { key: 'deposit', label: '创建免押' },
      { key: 'delete', label: '删除', danger: true },
    ]
  }

  async function handleActionMenu(order, item) {
    if (!item?.key) return
    if (item.key === 'detail') {
      await deps.openDetailModal(order)
      return
    }
    if (item.key === 'edit') {
      deps.openEditOrderDrawer(order)
      return
    }
    if (item.key === 'ship') {
      await deps.shipOrderWithSf(order)
      return
    }
    if (item.key === 'copy') {
      await deps.copyOrderNo(order)
      return
    }
    if (item.key === 'deposit') {
      deps.openCreateDeposit(order)
      return
    }
    if (item.key === 'delete') {
      await deps.deleteOrder(order)
    }
  }

  return {
    primaryActionLabel,
    isPrimaryActionDisabled,
    runPrimaryAction,
    actionMenuItems,
    handleActionMenu,
  }
}
