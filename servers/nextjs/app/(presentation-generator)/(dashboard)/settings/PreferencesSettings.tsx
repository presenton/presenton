import LocaleSwitcher from "@/components/LocaleSwitcher";

const PreferencesSettings = () => {
  return (
    <div className="w-full space-y-6">
      <div className="bg-[#F9F8F8] p-7 rounded-[20px]">
        <LocaleSwitcher />
      </div>
    </div>
  );
};

export default PreferencesSettings;
