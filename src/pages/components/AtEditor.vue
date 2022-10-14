<template>
  <div
    ref="atEditorRef"
    class="at-editor"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
    @input="onInput"
    @keydown.capture="onKeyDown"
  >
    <Toolbar
      style="border-bottom: 1px solid #ccc"
      :editor="editorRef"
      :defaultConfig="toolbarConfig"
      :mode="mode"
    />
    <Editor
      v-model="valueHtml"
      style="height: 100%; overflow: auto; min-height: 150px; max-height: 300px"
      :defaultConfig="editorConfig"
      :mode="mode"
      @onCreated="onEditorCreated"
      @onChange="onChange"
      @customPaste="customPaste"
    />
    <mention-modal
      v-if="props.at"
      :show="modal.show"
      :left="modal.left"
      :top="modal.top"
      :keyword="keyword"
      @hideMentionModal="hideModal"
      @insertMention="insertMention"
    ></mention-modal>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ZAtEditor',
}
</script>
<script lang="ts" setup>
import {
  ref,
  reactive,
  defineEmits,
  computed,
  defineProps,
  onMounted,
  onBeforeUnmount,
  watch,
  shallowRef,
  withDefaults,
  watchEffect,
} from 'vue'

import { IDomEditor, Boot, IEditorConfig, createEditor, createToolbar } from '@wangeditor/editor'
import mentionModule, { MentionElement } from '@/plugins/mention/'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { ElLoading } from 'element-plus'

import { toolbarConfig } from '@/components/z-editor/config'
import MentionModal from './MentionModal.vue'
import ossUpload from '@/utils/ossUpload'
import { Employee } from '@/interface/employee'
import { getEmployee, isCollapsed, isCursorMove, onBlur, isNameCharacter } from './utils'

Boot.registerModule(mentionModule)

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    at?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '请输入内容',
    at: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'change', val: string, empIds: number[]): void
}>()

const atEditorRef = ref()
const editorRef = shallowRef()

const valueHtml = ref('')
type InsertFnType = (url: string, alt: string, href: string) => void
const editorConfig: Partial<IEditorConfig> = {
  scroll: true,
  placeholder: props.placeholder,
  EXTEND_CONF: {
    mentionConfig: {
      showModal,
      hideModal,
    },
  },
  MENU_CONF: {
    uploadImage: {
      // 自定义上传
      async customUpload(file: File, insertFn: InsertFnType) {
        // TS 语法
        const loading = ElLoading.service({
          lock: true,
          text: '上传中...',
          background: 'rgba(0, 0, 0, 0.7)',
        })
        const res = await ossUpload(file, file.name)
        loading.close()
        // 最后插入图片
        insertFn(res.url, file.name, res.url)
      },
    },
  },
}

const mode = ref('simple')
const modal = reactive({
  show: false,
  left: 0,
  top: 0,
})
const hasComposition = ref(false)
const onCompositionStartBefore = ref(false)

const inputText = ref('')
const keyword = ref('')

watchEffect(() => {
  if (props.modelValue) {
    valueHtml.value = props.modelValue
  }
})

onMounted(() => {
  onBlur(atEditorRef.value, () => {
    // console.log('at textarea blur')
    hideModal(editorRef.value, 'blur')
  })
})

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
})

/**
 * 中文输入开始
 */
function onCompositionStart() {
  console.log('onCompositionStart')
  hasComposition.value = true
  if (onCompositionStartBefore.value) {
    deleteBackwardKeyword()
  }
  onCompositionStartBefore.value = false
}

/**
 * 中文输入结束
 */
function onCompositionEnd(event: CompositionEvent) {
  console.log('onCompositionEnd', event)
  keyword.value += event.data
  hasComposition.value = false
}

/**
 * 监听输入
 * @param val
 */
function onInput(val: InputEvent) {
  // console.log('onInput', val)
  inputText.value = val.data
}

/**
 * 监听键盘事件
 * @param e
 */
function onKeyDown(e: KeyboardEvent) {
  console.log('onKeyDown', e)
  if (!modal.show) {
    return
  }
  if (e.key === 'Backspace') {
    if (keyword.value.length === 0) {
      hideModal(editorRef.value, 'Backspace')
    }

    deleteBackwardKeyword()
    return
  }

  if (!hasComposition.value && isNameCharacter(e.key)) {
    keyword.value += e.key
    // 谷歌浏览器onCompositionStart在onKeyDown后触发
    // 中文输入时，会先记录一个英文字符
    onCompositionStartBefore.value = true
    setTimeout(() => {
      onCompositionStartBefore.value = false
    }, 50)
  }
}

/**
 * 删除查询字符串前一个字符
 */
function deleteBackwardKeyword() {
  keyword.value = keyword.value.slice(0, -1)
}

/**
 * 编辑器创建时
 * @param editor
 */
function onEditorCreated(editor: IDomEditor) {
  editorRef.value = editor
}

/**
 * 内容变化
 */
function onChange(editor: IDomEditor) {
  const html = editor.getHtml()
  const empIds = getEmployee(html).map((employee) => employee.empId)
  // console.log('onChange', html)

  if (!isCollapsed()) {
    hideModal(editor, 'isCollapsed')
  }

  if (!hasComposition.value && isCursorMove()) {
    hideModal(editor, 'isCursorMove')
  }

  emit('update:modelValue', html)
  emit('change', html, empIds)
}

/**
 * 显示@弹窗
 * @param editor
 */
function showModal(editor: IDomEditor) {
  if (!props.at) {
    return
  }

  // 获取光标位置，定位 modal
  const domSelection = document.getSelection()
  const domRange = domSelection.getRangeAt(0)
  if (domRange == null) return
  const selectionRect = domRange.getBoundingClientRect()
  // console.log('selectionRect', selectionRect)

  // 获取编辑区域 DOM 节点的位置，以辅助定位
  const containerRect = editor.getEditableContainer().getBoundingClientRect()
  // console.log('containerRect', containerRect)

  modal.left = selectionRect.x - containerRect.x + 30
  // modal.top = domSelection.y - containerRect.y

  modal.top = -200
  if (props.placeholder.includes('本周工作总结')) {
    modal.top = -50
  }
  modal.show = true
}

/**
 * 关闭@弹窗
 * @param editor
 */
function hideModal(editor: IDomEditor, source?: string) {
  // console.log('hideModal', editor, source)
  modal.show = false
  keyword.value = ''
}

/**
 * 选中某人
 * @param employee
 */
function insertMention(employee: Employee) {
  console.log('insertMention', employee)
  const mentionNode = {
    type: 'mention',
    value: employee.empCnName,
    info: {
      empId: employee.empId,
      empCnName: employee.empCnName,
      empLoginName: employee.empLoginName,
    },
    children: [{ text: '' }],
  }
  if (editorRef.value) {
    editorRef.value.restoreSelection() // 恢复选区
    deleteBackward(keyword.value)
    editorRef.value.insertNode(mentionNode) // 插入 mention
    editorRef.value.move(1) // 移动光标
  }
}

/**
 * 删除字符串
 * @param val
 */
function deleteBackward(val: string) {
  for (let i = 0; i < val.length; i++) {
    editorRef.value.deleteBackward()
  }
  editorRef.value.deleteBackward() // 删除@
}

/**
 * 复制内容为纯文本
 * @param editor
 * @param event
 */
function customPaste(editor: IDomEditor, event: ClipboardEvent): boolean {
  modal.show = false
  return true
}
</script>

<style lang="less">
.at-editor {
  .w-e-scroll {
    height: 150px !important;
    > div {
      height: 100% !important;
    }
  }
}
</style>

<style lang="less" scoped>
.at-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid rgb(204, 204, 204);
  margin: 0 0 10px 0;
  > div:nth-child(1) {
    height: 45px;
  }
  > div:nth-child(2) {
    overflow-y: hidden;
  }
}
</style>
