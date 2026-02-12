import { describe, expect, it } from 'vitest'

import {
  inferAttachmentMimeType,
  isSpreadsheetMimeType,
} from '@/lib/workspace-attachments'

describe('workspace attachments spreadsheet helpers', () => {
  it('infers spreadsheet mime types for open formats', () => {
    expect(inferAttachmentMimeType('report.ods')).toBe(
      'application/vnd.oasis.opendocument.spreadsheet',
    )
    expect(inferAttachmentMimeType('table.tsv')).toBe('text/tab-separated-values')
  })

  it('detects spreadsheet mimes case-insensitively', () => {
    expect(
      isSpreadsheetMimeType(
        'APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET',
      ),
    ).toBe(true)
    expect(isSpreadsheetMimeType('text/plain')).toBe(false)
  })
})
