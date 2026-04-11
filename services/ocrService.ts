import { OCRResult } from '@/types/database';

export const ocrService = {
  async parseScreenshot(imageUri: string): Promise<OCRResult> {
    const text = await this.extractTextFromImage(imageUri);

    const result: OCRResult = {
      raw_text: text,
      confidence: 0,
    };

    const dataLimitMatch = text.match(/(\d+)\s*(GB|gb|Gb)/i);
    if (dataLimitMatch) {
      result.data_limit_gb = parseInt(dataLimitMatch[1]);
      result.confidence += 0.3;
    }

    const carrierPatterns = [
      'Verizon',
      'AT&T',
      'T-Mobile',
      'Sprint',
      'Mint',
      'Visible',
      'Cricket',
    ];
    for (const carrier of carrierPatterns) {
      if (text.includes(carrier)) {
        result.carrier_name = carrier;
        result.confidence += 0.2;
        break;
      }
    }

    const monthlyMatch = text.match(
      /(monthly|month|per month|\/mo|\/month)/i
    );
    if (monthlyMatch) {
      result.cycle_type = 'monthly';
      result.confidence += 0.2;
    }

    const dayMatch = text.match(/renews?\s+on\s+the\s+(\d+)(st|nd|rd|th)?/i);
    if (dayMatch) {
      result.cycle_start_day = parseInt(dayMatch[1]);
      result.confidence += 0.2;
    } else if (result.cycle_type === 'monthly') {
      result.cycle_start_day = 1;
      result.confidence += 0.1;
    }

    const planNameMatch = text.match(
      /(unlimited|prepaid|postpaid|[a-z]+\s+plan)/i
    );
    if (planNameMatch) {
      result.plan_name = planNameMatch[0];
      result.confidence += 0.1;
    }

    return result;
  },

  async extractTextFromImage(imageUri: string): Promise<string> {
    const formData = new FormData();

    const response = await fetch(imageUri);
    const blob = await response.blob();

    formData.append('image', blob);
    formData.append('apikey', 'K88271894388957');
    formData.append('language', 'eng');

    try {
      const ocrResponse = await fetch(
        'https://api.ocr.space/parse/image',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await ocrResponse.json();

      if (result.ParsedResults && result.ParsedResults.length > 0) {
        return result.ParsedResults[0].ParsedText || '';
      }

      return '';
    } catch (error) {
      console.error('OCR failed:', error);
      return '';
    }
  },
};
