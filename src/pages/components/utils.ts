import { Employee } from '@/interface/employee'

export function getEmployee(html: string) {
  const mentionReg = /data-w-e-type="mention".[\s\S]*?data-info="(.*?)"/gm
  const mentionHtml = html.match(mentionReg)

  if (!mentionHtml) {
    return []
  }

  const arr: Employee[] = []
  const infoReg = /data-info="(.*?)"/

  mentionHtml.map((item) => {
    const infoMatch = item.match(infoReg)
    if (!infoMatch || infoMatch.length <= 1) {
      return
    }
    const infoCode = infoMatch[1]
    if (!infoCode) {
      return
    }
    const info = decodeURIComponent(infoCode)

    if (!info) {
      return
    }

    try {
      const infoObj = JSON.parse(info)
      if (!infoObj.empId) {
        return
      }

      arr.push(infoObj)
    } catch (err) {
      console.log('getEmployee', err)
    }
  })
  return arr
}

/**
 * 检测元素失焦
 * @param el
 * @param callback
 */
export function onBlur(el: HTMLElement, callback: () => void) {
  const handle = function (event: any) {
    if (el && !el.contains(event.target)) {
      callback()
    }
  }

  const removeHandle = function () {
    document.removeEventListener('click', handle)
  }

  document.addEventListener('click', handle)
  return removeHandle
}

/**
 * 获取一组元素的dom总高度
 * @param els
 */
export function getElementsHeight(els: HTMLElement[]) {
  let height = 0
  for (const node of els) {
    height += node.clientHeight
  }
  return height
}

/**
 * 是光标，非选区
 */
export function isCollapsed() {
  const domSelection = document.getSelection()
  if (!domSelection) {
    return
  }
  return domSelection.isCollapsed
}

/**
 * 光标移动了
 */
export function isCursorMove() {
  const domSelection = document.getSelection()

  if (!domSelection) {
    return
  }
  // console.log('domSelection.anchorOffset', domSelection.anchorOffset)
  return domSelection.anchorOffset !== 0
}

/**
 * 是域账户字符
 * @param val
 */
export function isNameCharacter(val: string) {
  console.log('isNameCharacter', val)
  return /^[a-zA-Z0-9_.]{1}$/.test(val)
  // const isWord = val >= 65 && val <= 90
  // const isNumber = (val >= 49 && val <= 57) || (val >= 96 && val <= 105)
  //
  // return isWord || isNumber || val === 110 || val === 189 || val === 190
}

export function isValidHtml(html: string) {
  if (html.includes('<img')) {
    return true
  }

  const reg = /<[^<>]+>/g
  let content = html.replace(reg, '')
  content = content.replace(/[&nbsp;\s]/gi, '')

  return content.length > 0
}
