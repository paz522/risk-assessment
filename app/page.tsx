import RiskAssessmentForm from "@/components/risk-assessment-form"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold text-center mb-2">リスク診断AIコンサルタント</h1>
        <p className="text-center text-muted-foreground mb-8">3分でわかる！起業後の生活リスク診断</p>
        <RiskAssessmentForm />
      </div>
    </main>
  )
}

