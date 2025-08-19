import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawCountryName: string = (body?.countryName ?? '').trim()
    const rawCityName: string = (body?.cityName ?? '').trim()

    if (!rawCountryName || !rawCityName) {
      return NextResponse.json({ error: 'countryName и cityName обязательны' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Нормализуем имена: убираем двойные пробелы
    const countryName = rawCountryName.replace(/\s+/g, ' ')
    const cityName = rawCityName.replace(/\s+/g, ' ')

    // 1) Страна: апсерт по уникальному name
    const { data: upsertedCountry, error: upsertCountryErr } = await admin
      .from('countries')
      .upsert({ name: countryName }, { onConflict: 'name' })
      .select('id')
      .single()

    if (upsertCountryErr || !upsertedCountry) {
      console.error('Ошибка апсерта страны:', upsertCountryErr)
      return NextResponse.json({ error: 'Не удалось сохранить страну' }, { status: 500 })
    }

    const countryId = upsertedCountry.id as string

    // 2) Город: апсерт по уникальному (country_id, name)
    const { data: upsertedCity, error: upsertCityErr } = await admin
      .from('cities')
      .upsert({ name: cityName, country_id: countryId }, { onConflict: 'country_id,name' })
      .select('id')
      .single()

    if (upsertCityErr || !upsertedCity) {
      console.error('Ошибка апсерта города:', upsertCityErr)
      return NextResponse.json({ error: 'Не удалось сохранить город' }, { status: 500 })
    }

    const cityId = upsertedCity.id as string

    return NextResponse.json({ countryId, cityId }, { status: 200 })
  } catch (error) {
    console.error('Неожиданная ошибка в /api/geo/upsert:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}


