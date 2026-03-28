import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const SKILL_COLORS = {
  'Beg/Int (6-10)': '#e67e22',
  'Beg/Int (10+)':  '#2980b9',
  'Int/Adv (6-10)': '#27ae60',
  'Int/Adv (10+)':  '#8e44ad',
}

function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lighten(hex, ratio = 0.72) {
  const [r, g, b] = hexToRgb(hex)
  return [Math.round(r + (255 - r) * ratio), Math.round(g + (255 - g) * ratio), Math.round(b + (255 - b) * ratio)]
}

export async function exportScheduleToPDF(gridElement, unscheduledClasses = [], teachers = [], colorMode = 'teacher') {
  if (!gridElement) return

  // Capture the inner grid (not the overflow:auto wrapper) so nothing is clipped
  const target = gridElement.querySelector('.weekly-grid') || gridElement

  const canvas = await html2canvas(target, {
    scale: 2,          // retina quality
    useCORS: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    width:  target.scrollWidth,
    height: target.scrollHeight,
    windowWidth:  target.scrollWidth,
    windowHeight: target.scrollHeight,
  })

  // Use a custom page size wide enough to fit the full grid
  // Minimum A4 landscape (297×210mm); scale up proportionally if the grid is wider
  const A4_W = 297
  const A4_H = 210
  const MARGIN_TOP  = 22
  const MARGIN_SIDE = 6
  const MARGIN_BOT  = 6
  const availH = A4_H - MARGIN_TOP - MARGIN_BOT

  // How wide does the page need to be so the grid fills the available height?
  const aspectRatio = canvas.width / canvas.height
  const neededW = Math.round(availH * aspectRatio + MARGIN_SIDE * 2)
  const pageW = Math.max(A4_W, neededW)
  const pageH = A4_H

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageW, pageH] })

  // Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(80, 0, 0)
  pdf.text('The Dance Collective McKinney — Weekly Schedule', pageW / 2, 12, { align: 'center' })

  // Date
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(120, 120, 120)
  pdf.text(`Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, pageW / 2, 18, { align: 'center' })

  // Grid image — fit within available area
  const availableW = pageW - MARGIN_SIDE * 2
  const scaleByW   = availableW / canvas.width
  const scaleByH   = availH / canvas.height
  const scale      = Math.min(scaleByW, scaleByH)
  const finalW     = canvas.width  * scale
  const finalH     = canvas.height * scale

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - finalW) / 2, MARGIN_TOP, finalW, finalH)

  // ── Page 2: Unscheduled classes ──────────────────────────────────────────
  if (unscheduledClasses.length > 0) {
    const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]))
    pdf.addPage([pageW, pageH], 'landscape')

    // Page title
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(80, 0, 0)
    pdf.text('The Dance Collective McKinney — Unscheduled Classes', pageW / 2, 12, { align: 'center' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(120, 120, 120)
    pdf.text(`${unscheduledClasses.length} class${unscheduledClasses.length !== 1 ? 'es' : ''} not yet placed`, pageW / 2, 18, { align: 'center' })

    // Table header
    const COL_X    = [8, 70, 110, 155, 195, 235]
    const COL_W    = [60, 38, 43, 38, 38, 50]
    const HDR_LABELS = ['Class', 'Genre', 'Skill Level', 'Duration', 'Teacher', 'Notes']
    const HDR_Y    = 24
    const ROW_H    = 7
    const FONT_SZ  = 8

    pdf.setFillColor(80, 0, 0)
    pdf.rect(COL_X[0], HDR_Y, COL_X[COL_X.length - 1] - COL_X[0] + COL_W[COL_W.length - 1], ROW_H, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(FONT_SZ)
    pdf.setTextColor(255, 255, 255)
    HDR_LABELS.forEach((lbl, i) => pdf.text(lbl, COL_X[i] + 1.5, HDR_Y + 4.8))

    // Table rows
    unscheduledClasses.forEach((cls, idx) => {
      const teacher = teacherMap[cls.teacherId]
      const accentHex = colorMode === 'skillLevel'
        ? (SKILL_COLORS[cls.skillLevel] ?? (teacher?.color ?? '#888888'))
        : (teacher?.color ?? '#888888')
      const [lr, lg, lb] = lighten(accentHex, 0.82)
      const rowY = HDR_Y + ROW_H + idx * ROW_H

      pdf.setFillColor(lr, lg, lb)
      pdf.rect(COL_X[0], rowY, COL_X[COL_X.length - 1] - COL_X[0] + COL_W[COL_W.length - 1], ROW_H, 'F')

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(FONT_SZ)
      pdf.setTextColor(0, 0, 0)

      const cells = [
        cls.name,
        cls.style || '',
        cls.skillLevel || '',
        cls.durationMinutes ? `${cls.durationMinutes} min` : '',
        teacher?.name || '',
        '',
      ]
      cells.forEach((txt, i) => {
        const maxW = COL_W[i] - 3
        const truncated = pdf.getTextWidth(txt) > maxW
          ? txt.slice(0, Math.floor(txt.length * maxW / pdf.getTextWidth(txt))) + '…'
          : txt
        pdf.text(truncated, COL_X[i] + 1.5, rowY + 4.8)
      })

      // subtle bottom border
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.1)
      pdf.line(COL_X[0], rowY + ROW_H, COL_X[COL_X.length - 1] + COL_W[COL_W.length - 1], rowY + ROW_H)
    })
  }

  pdf.save(`dance-schedule-${new Date().toISOString().slice(0, 10)}.pdf`)
}
