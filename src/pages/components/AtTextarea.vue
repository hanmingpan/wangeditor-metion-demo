<template>
  <div
    ref="atTextareaRef"
    class="at-textarea"
    :style="{ height: editorHeight + 'px' }"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
    @input="onInput"
    @keydown.capture="onKeyDown"
  >
    <Editor
      v-model="valueHtml"
      :defaultConfig="editorConfig"
      :mode="mode"
      @onCreated="onEditorCreated"
      @onChange="onChange"
      @customPaste="customPaste"
    />
    <mention-modal
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
  name: 'ZAtTextarea',
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
  defineExpose,
  watchEffect,
} from 'vue'

import { IDomEditor, Boot, IEditorConfig, createEditor, createToolbar } from '@wangeditor/editor'
import mentionModule, { MentionElement } from '@/plugins/mention/'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'

import MentionModal from './MentionModal.vue'
import { Employee } from '@/interface/employee'
import {
  getEmployee,
  onBlur,
  getElementsHeight,
  isCollapsed,
  isCursorMove,
  isNameCharacter,
} from './utils'

Boot.registerModule(mentionModule)

const MIN_HEIGHT = 32
const LINE_HEIGHT = 21
const MAX_HEIGHT = LINE_HEIGHT * 5

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder: string
  }>(),
  {
    modelValue: '',
    placeholder: '请输入',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'change', val: string, empIds: number[]): void
}>()

defineExpose({
  focus,
  clear,
})

const atTextareaRef = ref()
const editorRef = shallowRef()

const valueHtml = ref('')
const editorHeight = ref(MIN_HEIGHT)
const editorConfig: Partial<IEditorConfig> = {
  scroll: true,
  placeholder: props.placeholder,
  EXTEND_CONF: {
    mentionConfig: {
      showModal,
      hideModal,
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
  valueHtml.value = props.modelValue
})

onMounted(() => {
  onBlur(atTextareaRef.value, () => {
    // console.log('at textarea blur')
    hideModal(editorRef.value, 'blur')
  })
})

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) {
    return
  }
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
  // inputText.value = val.data
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
 * 根据内容自动调整高度
 */
function autoSetHeight() {
  const contentEl = atTextareaRef.value.querySelector('[contenteditable]')
  const childrenEl = contentEl.querySelectorAll('[data-slate-node=element]')
  const height = getElementsHeight(childrenEl)

  if (height < MIN_HEIGHT) {
    editorHeight.value = MIN_HEIGHT
    return
  }

  if (height > MAX_HEIGHT) {
    editorHeight.value = MAX_HEIGHT
    return
  }

  editorHeight.value = height
}

/**
 * 内容变化
 */
function onChange(editor: IDomEditor) {
  const html = editor.getHtml()
  const empIds = getEmployee(html).map((employee) => employee.empId)
  // console.log('onChange', html)
  autoSetHeight()

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
  // 获取光标位置，定位 modal
  const domSelection = document.getSelection()
  const domRange = domSelection.getRangeAt(0)
  console.log('domRange', domRange)
  if (domRange == null) return
  const selectionRect = domRange.getBoundingClientRect()
  // console.log('selectionRect', selectionRect)

  // 获取编辑区域 DOM 节点的位置，以辅助定位
  const containerRect = editor.getEditableContainer().getBoundingClientRect()
  // console.log('containerRect', containerRect)

  modal.left = selectionRect.x - containerRect.x
  // modal.top = domSelection.y - containerRect.y
  modal.top = -280

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
  // TODO 纯文本会被复制两次
  const text = event.clipboardData.getData('text/plain')

  if (text) {
    editor.insertText(text)
  }

  event.preventDefault()
  return false
}

/**
 * 定位光标
 */
function focus() {
  // console.log('at-textarea focus')
  editorRef.value.focus()
}

/**
 * 清空
 */
function clear() {
  valueHtml.value = ''
}
</script>

<style lang="less">
.at-textarea {
  position: relative;

  .w-e-text-container {
    background: #eff1f9;
  }
  .w-e-text-container [data-slate-editor] {
    padding: 5px 0;
    border-top: none;
  }

  .w-e-text-container [data-slate-editor] p {
    margin: 0 !important;
  }

  .w-e-text-placeholder {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    color: #a8abb8;
  }
}
</style>
