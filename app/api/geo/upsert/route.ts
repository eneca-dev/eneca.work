import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Check Content-Type header
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content-type. Expected application/json' }, { status: 400 })
    }

    // Parse JSON with proper error handling
    let body: any
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ error: 'Malformed JSON in request body' }, { status: 400 })
    }

    // Validate that countryName and cityName are strings
    if (typeof body?.countryName !== 'string') {
      return NextResponse.json({ error: 'countryName field has an invalid type. Expected string' }, { status: 400 })
    }
    if (typeof body?.cityName !== 'string') {
      return NextResponse.json({ error: 'cityName field has an invalid type. Expected string' }, { status: 400 })
    }

    // Now safely trim the confirmed string values
    const rawCountryName: string = body.countryName.trim()
    const rawCityName: string = body.cityName.trim()

    if (!rawCountryName || !rawCityName) {
      return NextResponse.json({ error: 'countryName и cityName обязательны' }, { status: 400 })
    }

    // Authenticate the user first
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Нормализуем имена: убираем двойные пробелы
    const countryName = rawCountryName.replace(/\s+/g, ' ')
    const cityName = rawCityName.replace(/\s+/g, ' ')

    // 1) Страна: апсерт по уникальному name
    const { data: upsertedCountry, error: upsertCountryErr } = await supabase
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
    const { data: upsertedCity, error: upsertCityErr } = await supabase
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


