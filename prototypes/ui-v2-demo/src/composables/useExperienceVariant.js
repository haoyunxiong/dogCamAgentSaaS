import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export const experienceVariants = [
  {
    key: 'b',
    label: 'B',
    name: '调度指挥台',
    shortName: '指挥台',
    description: '偏 PC 管理后台，突出订单、档期、设备的调度关系。'
  },
  {
    key: 'c',
    label: 'C',
    name: '运营脉冲',
    shortName: '脉冲版',
    description: '偏一线运营工具，节奏更活跃，行动入口更明确。'
  }
]

const STORAGE_KEY = 'ui-v2-demo-experience'
const currentVariant = ref('b')
let initialized = false

function normalizeVariant(value) {
  return experienceVariants.some((item) => item.key === value) ? value : 'b'
}

function persistVariant(value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, value)
}

export function useExperienceVariant() {
  const route = useRoute()
  const router = useRouter()

  if (!initialized) {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : ''
    currentVariant.value = normalizeVariant(route.query.variant || saved || 'b')
    initialized = true
  }

  watch(
    () => route.query.variant,
    (value) => {
      if (!value) return
      currentVariant.value = normalizeVariant(value)
      persistVariant(currentVariant.value)
    },
    { immediate: true }
  )

  const variantMeta = computed(() => experienceVariants.find((item) => item.key === currentVariant.value) || experienceVariants[0])

  function switchVariant(value) {
    const next = normalizeVariant(value)
    currentVariant.value = next
    persistVariant(next)
    router.replace({
      path: route.path,
      query: { ...route.query, variant: next },
      hash: route.hash
    })
  }

  return {
    variant: currentVariant,
    variantMeta,
    variants: experienceVariants,
    switchVariant
  }
}
