import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500">
      Loading map...
    </div>
  ),
});

export { DynamicMap };
