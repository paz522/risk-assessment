"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RiskResult } from "@/components/risk-result"
import { saveAssessmentData } from "@/lib/supabase"

// フォームのバリデーションスキーマ
const formSchema = z.object({
  familyStructure: z.string().min(1, {
    message: "家族構成を入力してください",
  }),
  familyCount: z.coerce.number().min(1, {
    message: "家族の人数を入力してください（1以上）",
  }),
  hasChildren: z.boolean().default(false),
  age: z.coerce.number().min(18, {
    message: "年齢を入力してください（18歳以上）",
  }).max(100, {
    message: "有効な年齢を入力してください",
  }).optional().default(0),
  savings: z.coerce.number().min(0, {
    message: "貯蓄額を入力してください",
  }),
  monthlyIncome: z.coerce.number().min(1, {
    message: "月収を入力してください",
  }),
})

export default function RiskAssessmentForm() {
  const [result, setResult] = useState<{
    score: number
    status: string
    advice: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // フォームの初期化
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      familyStructure: "",
      familyCount: 1,
      hasChildren: false,
      age: 0,
      savings: 0,
      monthlyIncome: 0,
    },
  })

  // フォーム送信時の処理
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)

    try {
      // リスクスコアの計算
      const { familyCount, savings, monthlyIncome } = values
      const score = calculateRiskScore(savings, monthlyIncome, familyCount)
      const status = getRiskStatus(score)
      const advice = generateAdvice(monthlyIncome, familyCount)

      // 結果の設定
      setResult({ score, status, advice })

      // Supabaseにデータを保存（オプション）
      try {
        await saveAssessmentData(values, score, status, advice)
      } catch (error) {
        console.error("データの保存に失敗しました:", error)
        // エラーがあってもユーザー体験を妨げないよう、続行します
      }

      // 結果表示部分までスクロール
      setTimeout(() => {
        const resultElement = document.getElementById('risk-result')
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    } finally {
      setIsSubmitting(false)
    }
  }

  // リスクスコアの計算関数
  function calculateRiskScore(savings: number, monthlyIncome: number, familyCount: number): number {
    // 家族構成の入力から子供の有無を判定
    const familyStructure = form.getValues().familyStructure.toLowerCase();
    const hasChildren = form.getValues().hasChildren || 
                        familyStructure.includes('子') || 
                        familyStructure.includes('こども') || 
                        familyStructure.includes('子供');
    
    // 子供の人数を推定（家族構成の文字列から数字を抽出）
    let childrenCount = 0;
    if (hasChildren) {
      // 家族構成から数字を抽出
      const numbers = familyStructure.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        // 最初に見つかった数字を子供の人数として使用
        childrenCount = parseInt(numbers[0], 10);
      } else {
        // 数字が見つからない場合は、家族の人数から推定（配偶者がいると仮定して-1）
        childrenCount = Math.max(1, familyCount - (familyStructure.includes('妻') || 
                                                  familyStructure.includes('夫') || 
                                                  familyStructure.includes('配偶者') ? 2 : 1));
      }
    }
    
    // 年齢を取得
    const userAge = form.getValues().age || 35; // デフォルト値として35を使用
    
    // 基本スコア: 貯蓄 ÷ (月収 × 家族人数)
    const baseScore = savings / (monthlyIncome * familyCount);
    
    // 0-100のスケールに変換（より緩い評価に調整：3ヶ月分の生活費を100点とする）
    let scaledScore = Math.min(Math.round((baseScore * 100) / 3), 100);
    
    // 最低スコアを40点に設定（極端に低いスコアを避ける）
    scaledScore = Math.max(40, scaledScore);
    
    // 年齢によるボーナススコア
    let ageBonus = 0;
    if (userAge < 30) {
      // 20代は若さのボーナス
      ageBonus = 15;
    } else if (userAge < 40) {
      // 30代は経験と若さのバランスボーナス
      ageBonus = 10;
    } else if (userAge < 50) {
      // 40代は経験と人脈のボーナス
      ageBonus = 8;
    } else if (userAge < 60) {
      // 50代は知恵と経験のボーナス
      ageBonus = 5;
    } else {
      // 60代以上はセカンドライフボーナス
      ageBonus = 3;
    }
    
    // 家族構成によるスコア調整
    let familyAdjustment = 0;
    if (hasChildren) {
      // 子供がいる場合は、子供の人数に応じてスコアを調整
      // 子供1人: -5点、2人: -10点、3人以上: -15点
      familyAdjustment = -5 * Math.min(3, childrenCount);
      
      // 子供がいる場合でも、最低スコアを確保（子供の人数に応じて変動）
      // 子供1人: 60点、2人: 55点、3人以上: 50点
      const minScoreWithChildren = 65 - (5 * Math.min(3, childrenCount));
      scaledScore = Math.max(minScoreWithChildren, scaledScore + familyAdjustment);
    } else if (familyCount > 1) {
      // 子供はいないが家族がいる場合（配偶者など）
      familyAdjustment = 5;
    } else {
      // 単身の場合
      familyAdjustment = 10;
    }
    
    // 月収レベルによるボーナス
    let incomeBonus = 0;
    if (monthlyIncome >= 500000) {
      // 高収入
      incomeBonus = 10;
    } else if (monthlyIncome >= 300000) {
      // 中〜高収入
      incomeBonus = 7;
    } else if (monthlyIncome >= 200000) {
      // 中収入
      incomeBonus = 5;
    } else {
      // 低〜中収入
      incomeBonus = 3;
    }
    
    // 貯蓄レベルによるボーナス
    const sixMonthsCost = monthlyIncome * familyCount * 6;
    let savingsBonus = 0;
    if (savings >= sixMonthsCost) {
      // 6ヶ月分以上の貯蓄
      savingsBonus = 10;
    } else if (savings >= sixMonthsCost / 2) {
      // 3ヶ月分以上の貯蓄
      savingsBonus = 7;
    } else if (savings >= sixMonthsCost / 4) {
      // 1.5ヶ月分以上の貯蓄
      savingsBonus = 5;
    } else {
      // それ以下の貯蓄
      savingsBonus = 2;
    }
    
    // 最終スコアの計算（ベーススコア + 各種ボーナス）
    let finalScore = scaledScore + ageBonus + familyAdjustment + incomeBonus + savingsBonus;
    
    // 子供がいない場合は、スコアを最低80点にする
    if (!hasChildren) {
      finalScore = Math.max(80, finalScore);
    }
    
    // 最終スコアは100点を超えないようにする
    finalScore = Math.min(100, finalScore);
    
    // 最終スコアを整数に丸める
    return Math.round(finalScore);
  }

  // リスク状態の判定
  function getRiskStatus(score: number): string {
    // より緩い判定基準に調整
    if (score <= 40) return "検討段階"
    if (score <= 70) return "準備OK"
    return "絶好のタイミング"
  }

  // アドバイスの生成
  function generateAdvice(monthlyIncome: number, familyCount: number): string {
    // 半年分の生活費を計算
    const sixMonthsCost = monthlyIncome * familyCount * 6
    const threeMonthsCost = monthlyIncome * familyCount * 3
    const savings = form.getValues().savings;
    const familyStructure = form.getValues().familyStructure.toLowerCase();
    const age = form.getValues().age;
    
    // 子供がいるかどうかを判定
    const hasChildren = form.getValues().hasChildren || 
                        familyStructure.includes('子') || 
                        familyStructure.includes('こども') || 
                        familyStructure.includes('子供');
    
    // 月収レベルの判定
    const getIncomeLevel = (income: number) => {
      if (income < 250000) return "low";
      if (income < 500000) return "medium";
      return "high";
    };
    
    const incomeLevel = getIncomeLevel(monthlyIncome);
    
    // 貯蓄レベルの判定
    const getSavingsLevel = (savings: number, targetAmount: number) => {
      const ratio = savings / targetAmount;
      if (ratio < 0.5) return "low"; // 目標の50%未満
      if (ratio < 1) return "medium"; // 目標の50%以上100%未満
      return "high"; // 目標達成
    };
    
    const savingsLevel = getSavingsLevel(savings, threeMonthsCost);
    
    // 総合リスクプロファイルの判定
    const getRiskProfile = () => {
      // 子供あり、貯蓄少、収入少 = 最高リスク
      if (hasChildren && savingsLevel === "low" && incomeLevel === "low") {
        return "highest";
      }
      // 子供あり、貯蓄中または少、収入中または少 = 高リスク
      if (hasChildren && (savingsLevel !== "high" || incomeLevel !== "high")) {
        return "high";
      }
      // 子供なし、貯蓄少、収入少 = 中リスク
      if (!hasChildren && savingsLevel === "low" && incomeLevel === "low") {
        return "medium";
      }
      // 貯蓄高、収入高 = 低リスク
      if (savingsLevel === "high" && incomeLevel === "high") {
        return "low";
      }
      // その他 = 中リスク
      return "medium";
    };
    
    const riskProfile = getRiskProfile();
    
    // 年齢に応じたアドバイス
    const getAgeBasedAdvice = () => {
      const userAge = form.getValues().age;
      if (!userAge || userAge === 0) return "";
      
      if (userAge < 30) {
        return `
【20代のあなたへ】
あなたの若さは最大の武器です！未来は無限の可能性に満ちています。

・20代は失敗してもリカバリーできる貴重な時期です。思い切ったチャレンジができるのは今です。
・デジタルネイティブとしての感覚やトレンドへの敏感さは、ビジネスにおいて大きな強みになります。
・今から経験を積むことで、30代、40代での飛躍的な成長につながります。
・若い起業家は投資家からも注目されやすく、支援を受けやすい傾向があります。
・エネルギーと柔軟性を活かして、新しい市場やニッチを開拓できるチャンスです。

あなたの行動力と新鮮な視点は、既存の市場に革新をもたらす可能性を秘めています！`;
      } else if (userAge < 40) {
        return `
【30代のあなたへ】
30代は経験と若さのバランスが取れた最高の時期です！

・30代は専門性と実務経験が蓄積され始め、起業に最適な時期と言われています。
・若さとスタミナを持ちながらも、業界の知識や人脈が形成されている絶妙なバランスです。
・家族形成期でもあり、長期的な視点でビジネスを考えられる時期です。
・失敗からの学びを活かせる柔軟性と、安定を求める責任感のバランスが取れています。
・あなたの実務経験は、起業における現実的な判断力の基盤になります。

あなたのキャリアで培った専門知識と若さのエネルギーは、成功への強力な推進力になるでしょう！`;
      } else if (userAge < 50) {
        return `
【40代のあなたへ】
40代は経験と人脈が充実した、起業の黄金期です！

・40代はこれまでのキャリアで培った専門知識と人脈が最大限に活きる時期です。
・業界での信頼関係がすでに構築されており、初期顧客の獲得がスムーズです。
・マネジメント経験があれば、チームビルディングやリーダーシップのスキルが大きな強みになります。
・人生経験から来る判断力と冷静さは、ビジネスの安定成長に不可欠な要素です。
・家族や周囲の理解も得やすく、サポート体制を整えやすい時期です。

あなたの豊富な経験と人脈は、起業成功への最短ルートを切り開くでしょう！`;
      } else if (userAge < 60) {
        return `
【50代のあなたへ】
50代は知恵と経験が満ち溢れた、起業の成熟期です！

・50代は長年のキャリアで培った深い専門知識と広範な人脈が最大の武器になります。
・業界の課題や顧客ニーズを熟知しており、的確なソリューションを提供できる立場です。
・財務的にも比較的余裕がある時期で、リスクに対する耐性が高まっています。
・豊富な人生経験からくる冷静な判断力と問題解決能力は、ビジネスの安定と成長に直結します。
・若手起業家のメンターとしての役割も果たせる、社会的価値の高い立場です。

あなたの豊かな経験と知恵は、持続可能なビジネスを構築する強固な基盤となるでしょう！`;
      } else {
        return `
【60代以上のあなたへ】
60代以上は知識と知恵の集大成、セカンドライフの新たな挑戦の時です！

・60代以上は長年培った専門知識、人脈、人生経験が結実する素晴らしい時期です。
・時間的な余裕があり、自分の情熱を注げる事業に取り組める絶好のチャンスです。
・豊富な人生経験と冷静な判断力は、安定したビジネス運営の鍵となります。
・若い世代にはない視点や知恵を活かした、ユニークなビジネスモデルを構築できます。
・社会貢献や価値創造など、経済的成功だけでない多様な目標を設定できる自由があります。
・デジタル技術と従来の知恵を組み合わせた、世代を超えたイノベーションを起こせる立場です。

あなたの豊かな経験と知恵は、社会に新たな価値をもたらす貴重な資産です！`;
      }
    };

    // 貯蓄目標に対する現在の状況を計算するための関数を追加
    const getSavingsGoalAdvice = (savings: number, targetAmount: number) => {
      const difference = targetAmount - savings;
      if (difference <= 0) {
        return `すでに${targetAmount.toLocaleString()}円の目標を達成しています。次のステップとして、事業資金の確保を検討しましょう。`;
      } else {
        // 月収の20%を貯蓄に回した場合の月数を計算
        const monthsToSave = Math.ceil(difference / (monthlyIncome * 0.2));
        return `あと${difference.toLocaleString()}円の貯蓄が必要です。月収の20%（${(monthlyIncome * 0.2).toLocaleString()}円）を貯蓄に回すと、約${monthsToSave}ヶ月で達成できます。`;
      }
    };

    // 家族構成に応じたアドバイス
    const getFamilyAdvice = () => {
      if (hasChildren) {
        return `
【子育て世帯向けアドバイス】
・子供がいる家庭では、教育費や将来の進学費用も考慮した資金計画が重要です。
・起業は子供に「チャレンジする姿」を見せる貴重な機会でもあります。
・子供の将来のためにも、あなたが情熱を持って取り組める仕事を選ぶことは大切です。
・起業初期は在宅や時間の融通が利く働き方ができるため、子育てとの両立がしやすくなる場合もあります。
・家族の理解と協力を得るために、起業計画や将来のビジョンを共有しましょう。
・子育て世帯向けの公的支援制度（児童手当、医療費助成など）も活用して、固定費を抑える工夫をしましょう。
・同じく子育て中の起業家とのネットワークを構築し、情報交換や相互支援の関係を作ることも有効です。`;
      } else if (familyCount > 1) {
        return `
【家族構成に応じたアドバイス】
・家族がいる場合は、生命保険や医療保険の見直しを行いましょう。
・家族と起業についてオープンに話し合い、理解と協力を得ることが重要です。
・家族の将来のライフプランも考慮した資金計画を立てましょう。
・配偶者の収入がある場合は、一時的に家計の主な支え手になってもらうことも検討できます。
・家族の健康保険や社会保険の切り替えについても事前に調査しておきましょう。`;
      }
      return `
【単身者向けアドバイス】
・単身の場合は、リスクを取りやすい状況にあります。この機会を最大限に活かしましょう。
・生活コストを見直し、固定費の削減ポイントを探してみましょう。
・万が一の事態に備えた医療保険の加入を検討しましょう。
・単身であることを活かして、起業初期は生活コストを最小限に抑えることも検討できます。
・将来的なライフプランの変化（結婚、家族形成など）も視野に入れた長期的な事業計画を立てましょう。`;
    };

    // 月収に応じた具体的なアドバイス
    const getIncomeBasedAdvice = () => {
      switch (incomeLevel) {
        case "low":
          return `
【月収に応じたアドバイス】
・現在の月収は比較的低めですが、起業によって収入を増やせる可能性があります。
・まずは副業として小規模に始め、月5万円の副収入から作りましょう。
・スキルアップに投資し、提供できるサービスの価値を高めることを優先してください。
・初期投資を最小限に抑えたビジネスモデル（オンラインサービス、コンサルティングなど）から始めましょう。
・固定費を徹底的に見直し、生活防衛資金を少しずつ増やしていきましょう。`;
          
        case "medium":
          return `
【月収に応じたアドバイス】
・現在の月収は平均的で、起業の基盤としては良いスタートポイントです。
・本業を続けながら、週末や平日夜に副業として事業を始め、月10〜15万円の副収入を目指しましょう。
・副業収入が本業の半分に達したら、独立を検討するタイミングかもしれません。
・あなたのスキルや経験を活かせる分野で、差別化できるサービスを考えましょう。
・本業で培った人脈やスキルを最大限に活用し、初期顧客の獲得に繋げましょう。`;
          
        case "high":
          return `
【月収に応じたアドバイス】
・現在の月収は高めで、起業のための良い資金基盤があります。
・高収入を活かして、積極的に事業資金を確保しましょう。
・あなたの専門性を活かした高単価サービスの提供を検討してください。
・必要に応じて従業員やフリーランスを雇用し、早期にビジネスを拡大する戦略も有効です。
・高収入の経験を活かして、ターゲット顧客を明確にし、プレミアムサービスの提供を検討しましょう。
・投資や資産運用も並行して行い、複数の収入源を確保することをおすすめします。`;
          
        default:
          return "";
      }
    };

    // 具体的な行動アドバイス
    const getActionSteps = () => {
      // 月収レベルに応じた行動ステップ
      const incomeBasedSteps = {
        low: [
          "最小限の初期投資で始められるビジネスモデルを選ぶ",
          "スキルアップのためのオンライン学習に投資する",
          "SNSを活用した無料マーケティングから始める",
        ],
        medium: [
          "本業と副業のバランスを取りながら、段階的に移行する計画を立てる",
          "初期顧客獲得のために、既存の人脈を活用する",
          "月次で収支を分析し、事業の採算性を確認する",
        ],
        high: [
          "専門性を活かした高単価サービスの開発に注力する",
          "必要に応じて外部人材を活用し、早期にビジネスを拡大する",
          "事業と資産運用の両面から収入源を多様化する",
        ]
      };

      // 子供の有無に応じた追加ステップ
      const childrenSteps = hasChildren ? [
        "子育てと両立できる柔軟な働き方を事業計画に組み込む",
        "家族の時間を確保するためのタイムマネジメント戦略を立てる",
        "子育て世帯向けの支援制度や税制優遇を調査し活用する"
      ] : [];

      // 年齢に応じた追加ステップ
      const getAgeSteps = () => {
        const userAge = form.getValues().age;
        if (!userAge || userAge === 0) return [];
        
        if (userAge < 30) {
          return [
            "若手起業家向けのコミュニティやイベントに積極的に参加する",
            "メンターを見つけて定期的にアドバイスを受ける",
            "デジタルスキルを最大限に活用したビジネスモデルを検討する"
          ];
        } else if (userAge < 40) {
          return [
            "これまでのキャリアで培った専門知識を活かせる分野を選ぶ",
            "仕事と家庭のバランスを考慮した事業計画を立てる",
            "同世代の起業家ネットワークを構築する"
          ];
        } else if (userAge < 50) {
          return [
            "長年の業界経験を活かした差別化戦略を立てる",
            "既存の人脈を活用して初期顧客を獲得する",
            "若手人材の採用・育成計画を検討する"
          ];
        } else {
          return [
            "豊富な経験と知識を活かしたコンサルティングやメンタリングを検討する",
            "ワークライフバランスを重視した事業設計を行う",
            "デジタル技術を活用して効率的なビジネスモデルを構築する"
          ];
        }
      };

      const commonSteps = [
        "収支管理アプリで毎月の支出を可視化する",
        "起業後の事業計画書を作成し、必要資金を明確にする",
        "起業仲間やメンターを見つけて定期的に相談する"
      ];

      const specificSteps = incomeBasedSteps[incomeLevel as keyof typeof incomeBasedSteps] || [];
      const ageSteps = getAgeSteps();
      const allSteps = [...commonSteps, ...specificSteps, ...childrenSteps, ...ageSteps];

      return `
【具体的な行動ステップ】
${allSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
    };

    // 貯蓄額が少ない場合の副業スタートアドバイス
    const getLowSavingsAdvice = () => {
      if (savings < threeMonthsCost) {
        const childrenAdvice = hasChildren ? 
          `・子育て中でも始められる、時間や場所に縛られない副業（ブログ執筆、オンラインコンサルティング、デジタル商品販売など）を検討しましょう。
・子供の寝ている時間や保育園・学校に行っている時間を活用して、少しずつビジネスを構築していきましょう。
・配偶者と協力して時間を確保する方法を話し合いましょう。` : '';
        
        return `
【貯蓄が少なくても大丈夫】
・まずは本業を続けながら、週末や平日夜に副業として事業をスタートさせましょう。
・月に${incomeLevel === "low" ? "5〜10万円" : incomeLevel === "medium" ? "10〜15万円" : "15〜20万円"}の副収入を作ることから始め、徐々に拡大していくことで、リスクを抑えられます。
・副業期間中に顧客基盤やスキルを構築できれば、独立時の不安も軽減できます。
・最初は投資を抑えたビジネスモデル（${incomeLevel === "low" ? "個人サービス提供やオンラインコンテンツ販売" : incomeLevel === "medium" ? "コンサルティングやコーチング" : "プレミアムコンサルティングや専門サービス"}など）から始めるのも一つの方法です。
${childrenAdvice}`;
      }
      return "";
    };

    // サラリーマンと起業家のリスク比較
    const getCareerRiskComparison = () => {
      const childrenAdvice = hasChildren ? 
        `・子供の将来のためにも、親が自分の夢に挑戦する姿を見せることは、大きな教育的価値があります。
・起業家として成功すれば、子供の教育資金や将来の選択肢を広げるための経済的基盤を築けます。
・会社員よりも柔軟な働き方ができるため、子供の行事や緊急時にも対応しやすくなります。` : '';
      
      return `
【サラリーマンも安泰ではない】
・終身雇用の崩壊、AI台頭による仕事の変化など、サラリーマンにも大きなリスクがあります。
・会社員は「一つの会社」に依存するリスクがありますが、起業家は「複数の顧客」に支えられる強みがあります。
・起業は自分の力で未来を切り開ける可能性があり、同じリスクを取るなら自分の夢に賭ける方が充実感も大きいでしょう。
・会社員時代に培ったスキルや人脈は、起業後も大きな資産になります。
${childrenAdvice}`;
    };

    // リスクプロファイルに応じた背中を押すメッセージ
    const getEncouragementMessage = () => {
      if (riskProfile === "highest") {
        return `
【あなたへの特別なメッセージ】
子育てしながらの起業は確かに挑戦ですが、多くの成功例があります。子供の存在がモチベーションとなり、効率的な働き方を模索するきっかけにもなります。まずは副業から始めて、少しずつリスクを減らしながら前進しましょう。子供に「夢を追いかける親」の姿を見せることは、何物にも代えがたい教育です。

あなたの情熱とアイデアは、新しい価値を生み出す原動力です。起業は人生を変える大きなチャンスです。一歩踏み出す勇気を持ちましょう！`;
      } else if (riskProfile === "high") {
        return `
【あなたへの特別なメッセージ】
家族がいることで慎重になるのは自然なことですが、それが夢を諦める理由にはなりません。むしろ、家族の存在が長期的な視点と責任感を育み、ビジネスの安定性につながることもあります。計画的に進めれば、家族の理解と協力を得ながら、着実に夢を実現できるでしょう。

今こそ行動するときです。あなたのスキルと経験は、独自のビジネスを成功させる大きな武器になります。自分の可能性を信じて、一歩前に踏み出しましょう！`;
      } else if (hasChildren) {
        return `
【あなたへの特別なメッセージ】
子育てと起業の両立は、時間管理と優先順位付けの達人になるチャンスです。多くの親起業家が、子供の存在によって効率的な働き方を学び、むしろ成功につなげています。子供に「自分の人生を自分で切り拓く」生き方を見せることは、最高の教育になるでしょう。

あなたの夢を追いかける姿は、子供たちにとって最高のロールモデルになります。今日から小さな一歩を踏み出し、その一歩を積み重ねていきましょう！`;
      } else {
        return `
【あなたへの特別なメッセージ】
起業は不安もありますが、自分の情熱を仕事にできる素晴らしいチャンスです。あなたのアイデアやスキルは、世界に新しい価値をもたらす可能性を秘めています。

人生は一度きり。「やらなかった後悔」より「やった経験」の方が、あなたを成長させてくれます。今日から小さな一歩を踏み出し、あなたの夢に向かって進んでいきましょう！`;
      }
    };

    // 基本的なアドバイスに加えて、新しいセクションを追加
    return `
【資金目標】
最低でも${threeMonthsCost.toLocaleString()}円（3ヶ月分）の生活費を確保することをおすすめします。
理想的には${sixMonthsCost.toLocaleString()}円（6ヶ月分）あれば、安心して起業に集中できます。
${getSavingsGoalAdvice(savings, threeMonthsCost)}

${getAgeBasedAdvice()}

${getIncomeBasedAdvice()}

${getFamilyAdvice()}
${getLowSavingsAdvice()}
${getCareerRiskComparison()}
${getEncouragementMessage()}
${getActionSteps()}
    `.trim();
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>リスク診断フォーム</CardTitle>
        <CardDescription>家族構成、貯蓄額、収入を入力して起業リスクを診断します</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="familyStructure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>家族構成</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 妻と子2人" {...field} onChange={(e) => {
                        field.onChange(e);
                        // 家族構成の入力から子供の有無を自動判定
                        const hasChildren = e.target.value.toLowerCase().includes('子') || 
                                           e.target.value.toLowerCase().includes('こども') || 
                                           e.target.value.toLowerCase().includes('子供');
                        form.setValue('hasChildren', hasChildren);
                      }} />
                    </FormControl>
                    <FormDescription>あなたの家族構成を入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="familyCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>家族の人数</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="例: 4" {...field} />
                    </FormControl>
                    <FormDescription>あなたを含めた家族の総人数</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>年齢</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="18" 
                        max="100" 
                        placeholder="例: 35" 
                        {...field} 
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>あなたの年齢（任意）</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="savings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>貯蓄額（円）</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="例: 2000000" {...field} />
                    </FormControl>
                    <FormDescription>現在の貯蓄総額を入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthlyIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>現在の月収（円）</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="例: 300000" {...field} />
                    </FormControl>
                    <FormDescription>現在の月収を入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                "計算中..."
              ) : (
                <>
                  診断する <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {result && (
        <CardFooter className="flex flex-col">
          <div id="risk-result">
            <RiskResult score={result.score} status={result.status} advice={result.advice} />
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

