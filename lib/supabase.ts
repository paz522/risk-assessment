// Supabaseクライアントの設定
import { createClient } from "@supabase/supabase-js"

// 環境変数からSupabaseの接続情報を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabaseクライアントの初期化（環境変数が設定されている場合のみ）
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

// 診断データをSupabaseに保存する関数
export async function saveAssessmentData(
  formData: {
    familyStructure: string
    familyCount: number
    savings: number
    monthlyIncome: number
  },
  score: number,
  status: string,
  advice?: string
) {
  // Supabaseクライアントが初期化されていない場合は処理をスキップ
  if (!supabase) {
    console.warn("Supabase client is not initialized. Data will not be saved.")
    return null
  }

  try {
    // assessmentsテーブルにデータを挿入
    const { data, error } = await supabase
      .from("assessments")
      .insert([
        {
          family_structure: formData.familyStructure,
          family_count: formData.familyCount,
          savings: formData.savings,
          monthly_income: formData.monthlyIncome,
          risk_score: score,
          risk_status: status,
          advice: advice || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error saving data to Supabase:", error)
    throw error
  }
}

// Supabaseのテーブル作成用のSQL（参考）
/*
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_structure TEXT NOT NULL,
  family_count INTEGER NOT NULL,
  savings INTEGER NOT NULL,
  monthly_income INTEGER NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_status TEXT NOT NULL,
  advice TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_assessments_created_at ON assessments(created_at);
*/

