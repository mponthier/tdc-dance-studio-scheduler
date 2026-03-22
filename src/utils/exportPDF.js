import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportScheduleToPDF(gridElement) {
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

  pdf.save(`dance-schedule-${new Date().toISOString().slice(0, 10)}.pdf`)
}
