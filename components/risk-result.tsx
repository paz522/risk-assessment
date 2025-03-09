"use client"

import { AlertCircle, CheckCircle, AlertTriangle, Info, ArrowRight, ListChecks, Briefcase, Lightbulb, DollarSign, BarChart, Heart, MessageCircle, Rocket, HelpCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RiskResultProps {
  score: number
  status: string
  advice: string
}

export function RiskResult({ score, status, advice }: RiskResultProps) {
  // スコアに基づいてアラートの種類とアイコンを決定
  const getStatusIcon = () => {
    if (score <= 40) return <AlertTriangle className="h-5 w-5 text-amber-500" />
    if (score <= 70) return <CheckCircle className="h-5 w-5 text-emerald-500" />
    return <Rocket className="h-5 w-5 text-blue-500" />
  }

  const getStatusDescription = () => {
    if (score <= 40) return "起業に向けて準備を始めるタイミングです。副業から始めて、徐々にステップアップしていきましょう。"
    if (score <= 70) return "起業の準備が整いつつあります。計画を具体化して、行動に移すタイミングです。"
    return "起業に最適なタイミングです！あなたの情熱とアイデアを形にするチャンスです。"
  }

  // スコアに基づいてプログレスバーの色を決定
  const getProgressColor = () => {
    if (score <= 40) return "bg-amber-500"
    if (score <= 70) return "bg-emerald-500"
    return "bg-blue-500"
  }

  // アドバイスをセクションごとに分割して表示
  const renderAdviceSection = () => {
    // アドバイスの各セクションを抽出
    const sections = advice.split(/【(.+?)】/).filter(Boolean);
    const formattedSections = [];
    
    for (let i = 0; i < sections.length; i += 2) {
      if (i + 1 < sections.length) {
        formattedSections.push({
          title: sections[i],
          content: sections[i + 1].trim()
        });
      }
    }

    // セクションごとに適切なアイコンを選択
    const getSectionIcon = (title: string, index: number) => {
      if (title.includes('資金目標')) return <Info className="h-5 w-5 text-blue-500" />;
      if (title.includes('月収に応じた')) return <DollarSign className="h-5 w-5 text-emerald-500" />;
      if (title.includes('子育て世帯向け')) return <Heart className="h-5 w-5 text-pink-500" />;
      if (title.includes('家族構成')) return <AlertCircle className="h-5 w-5 text-orange-500" />;
      if (title.includes('単身者向け')) return <AlertCircle className="h-5 w-5 text-orange-500" />;
      if (title.includes('貯蓄が少なくても')) return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      if (title.includes('サラリーマン')) return <Briefcase className="h-5 w-5 text-purple-500" />;
      if (title.includes('具体的な行動')) return <ListChecks className="h-5 w-5 text-green-500" />;
      if (title.includes('あなたへの特別')) return <MessageCircle className="h-5 w-5 text-rose-500" />;
      
      // デフォルトのアイコン
      const defaultIcons = [
        <Info className="h-5 w-5 text-blue-500" key="info" />,
        <BarChart className="h-5 w-5 text-indigo-500" key="chart" />,
        <ListChecks className="h-5 w-5 text-green-500" key="list" />
      ];
      return defaultIcons[index % defaultIcons.length];
    };

    // セクションの表示順序を最適化
    const getDisplayOrder = (title: string) => {
      const orderMap: Record<string, number> = {
        'あなたへの特別': 1,
        '資金目標': 2,
        '月収に応じた': 3,
        '子育て世帯向け': 4,
        '家族構成': 4,
        '単身者向け': 4,
        '貯蓄が少なくても': 5,
        'サラリーマン': 6,
        '具体的な行動': 7
      };
      
      for (const key in orderMap) {
        if (title.includes(key)) {
          return orderMap[key];
        }
      }
      return 99; // その他のセクション
    };
    
    // セクションを表示順序でソート
    const sortedSections = [...formattedSections].sort((a, b) => {
      return getDisplayOrder(a.title) - getDisplayOrder(b.title);
    });

    // 特別なメッセージセクションを強調表示
    const renderSection = (section: {title: string, content: string}, index: number) => {
      const isSpecialMessage = section.title.includes('あなたへの特別');
      
      return (
        <div key={index} className={`space-y-3 mb-6 ${isSpecialMessage ? 'bg-rose-50 dark:bg-rose-900/20 p-5 rounded-lg border border-rose-200 dark:border-rose-800' : ''}`}>
          <div className="flex items-center gap-3">
            {getSectionIcon(section.title, index)}
            <h4 className={`text-lg font-medium ${isSpecialMessage ? 'text-rose-600 dark:text-rose-400' : ''}`}>{section.title}</h4>
          </div>
          <div className="pl-8">
            <p className={`text-base leading-relaxed ${isSpecialMessage ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'} whitespace-pre-line`}>{section.content}</p>
          </div>
          {index < sortedSections.length - 1 && <Separator className="my-4" />}
        </div>
      );
    };

    return (
      <div className="space-y-5">
        {sortedSections.map((section, index) => renderSection(section, index))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 mt-6" id="risk-result">
      <h3 className="text-2xl font-semibold">診断結果</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">リスクスコア: {score}/100</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>スコアが高いほど経済的なリスクが低く、安心して起業に踏み出せる状態です</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-base font-medium text-blue-600">{status}</span>
        </div>
        <Progress value={score} className={`h-3 [&>div]:${getProgressColor()}`} />
      </div>

      <Alert variant="default" className="mb-6 p-5">
        <div className="flex items-center gap-3 mb-2">
          {getStatusIcon()}
          <AlertTitle className="text-lg">{status}</AlertTitle>
        </div>
        <AlertDescription className="text-base leading-relaxed pl-8">{getStatusDescription()}</AlertDescription>
      </Alert>

      <Card className="border-2 border-blue-100 dark:border-blue-900">
        <CardContent className="pt-8 pb-6">
          <h4 className="text-xl font-medium mb-6 flex items-center">
            <ArrowRight className="h-6 w-6 mr-3 text-blue-500" />
            次のステップに向けたアドバイス
          </h4>
          {renderAdviceSection()}
        </CardContent>
      </Card>
    </div>
  )
}

