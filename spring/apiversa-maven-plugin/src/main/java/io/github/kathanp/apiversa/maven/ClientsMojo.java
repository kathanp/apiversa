package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Compare Python and Go client files. Does not write. */
@Mojo(name = "clients", requiresProject = true)
public class ClientsMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.check", defaultValue = "false")
    private boolean check;

    @Override
    public void execute() throws MojoFailureException {
        if (!check) return;
        try {
            if (!Clients.matches(dir.toPath())) throw new MojoFailureException("client files differ");
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
