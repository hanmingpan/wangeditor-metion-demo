<template>
  <div v-show="show" class="mention-modal" :style="{ top: top + 'px', left: left + 'px' }">
    <ul class="mention-list">
      <li
        class="mention-item"
        v-for="item in employeeList"
        :key="item.empId"
        @click="insertMentionHandler(item)"
      >
        {{ item.empCnName }} （{{ item.empLoginName }}）
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import {
  ref,
  reactive,
  defineEmits,
  computed,
  defineProps,
  onMounted,
  watchEffect,
  watch,
} from 'vue'
import { remoteEmployeeList } from '@/api/user'
import { Employee } from '@/interface/employee'
import { IDomEditor } from '@wangeditor/editor'

const props = defineProps<{
  show: boolean
  left: number
  top: number
  keyword: string
}>()

const emit = defineEmits<{
  (e: 'hideMentionModal', editor: IDomEditor, source: string): void
  (e: 'insertMention', val: Employee): void
}>()

const query = reactive({
  keyword: '',
  currentPageNum: 1,
  pageSize: 10,
})
const employeeList = ref<Employee[]>([])
let timeout = 0

watch(
  () => props.keyword,
  (newVal, oldValue) => {
    console.log('mention show', props.show)
    console.log('mention keyword', props.keyword)

    if (newVal === oldValue) {
      return
    }

    query.keyword = props.keyword
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = window.setTimeout(getEmployeeList, 200)
  },
)

onMounted(() => {
  getEmployeeList()
})

/**
 * 查询员工列表
 */
async function getEmployeeList() {
  const res = await remoteEmployeeList(query)
  const { success, data } = res.data
  if (success) {
    employeeList.value = data.records
    if (employeeList.value.length <= 0) {
      emit('hideMentionModal', null, 'getEmployeeList')
    }
  }
}

/**
 * 选中
 * @param item
 */
function insertMentionHandler(item: Employee) {
  console.log('insertMentionHandler')
  emit('insertMention', item)
  emit('hideMentionModal', null, 'insertMentionHandler')
}
</script>

<style lang="less" scoped>
.mention {
  &-modal {
    width: 200px;
    height: 270px;
    position: absolute;
    background-color: #fff;
    border-radius: 6px;
    left: 0;
    top: 0;
    box-shadow: 0 0 8px 0 #e9ecf7;
  }

  &-list {
    padding: 0;
    margin: 0;
  }

  &-item {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    height: 27px;
    padding: 0 12px;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: #eff1f9;
    }
  }
}
</style>
