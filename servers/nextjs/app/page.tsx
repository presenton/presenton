import AuthGate from "@/components/Auth/AuthGate";
import Home from "@/components/Home";
import { ConfigurationInitializer } from "./ConfigurationInitializer";
import { isAuthDisabled } from "@/utils/auth";
import { getServerAuthStatus } from "@/utils/serverAuth";

const page = async () => {
    if (isAuthDisabled()) {
        return (
            <ConfigurationInitializer>
                <Home />
            </ConfigurationInitializer>
        );
    }

    const status = await getServerAuthStatus();
    if (status.configured && status.authenticated) {
        return (
            <ConfigurationInitializer>
                <Home />
            </ConfigurationInitializer>
        );
    }

    return <AuthGate />;
};

export default page;
